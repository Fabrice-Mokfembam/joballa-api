import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, PreferredLanguage } from '@prisma/client';
import { Resend } from 'resend';
import { looksLikeEmail } from '../utils/identifier.util';

/** Africa's Talking POST /version1/messaging JSON (subset). */
type AtSmsRecipient = {
  statusCode?: number;
  number?: string;
  status?: string;
  cost?: string;
  messageId?: string;
};

type AtSmsResponse = {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AtSmsRecipient[];
  };
};

export type OtpSendContext = {
  purpose: OtpPurpose;
  language: PreferredLanguage;
};

@Injectable()
export class AuthMessagingService {
  private readonly logger = new Logger(AuthMessagingService.name);

  constructor(private readonly config: ConfigService) {}

  /** Resend-safe `from`: supports `Joballa <onboarding@resend.dev>` or email + RESEND_FROM_NAME. */
  private resendFromAddress(): string {
    const raw = this.config.get<string>('RESEND_FROM_EMAIL')?.trim();
    if (!raw) {
      const fallbackName = this.config.get<string>('RESEND_FROM_NAME')?.trim();
      return fallbackName
        ? `${fallbackName} <onboarding@resend.dev>`
        : 'onboarding@resend.dev';
    }
    const name = this.config.get<string>('RESEND_FROM_NAME')?.trim();
    if (raw.includes('<') && raw.includes('>')) {
      return raw;
    }
    if (name) {
      return `${name} <${raw}>`;
    }
    return raw;
  }

  private replyToOptional(): string | undefined {
    return this.config.get<string>('RESEND_REPLY_TO')?.trim() || undefined;
  }

  /** Sends OTP via Resend (email) or Africa's Talking (SMS). Copy aligns with web handoff (EN/FR). */
  async sendOtp(
    identifier: string,
    otp: string,
    expiresMinutes: number,
    context: OtpSendContext,
  ): Promise<void> {
    if (looksLikeEmail(identifier)) {
      const { subject, text } = emailOtpContent(
        context.purpose,
        context.language,
        otp,
        expiresMinutes,
      );
      await this.sendEmailOtp(identifier, subject, text);
      return;
    }

    const sms = smsOtpContent(
      context.purpose,
      context.language,
      otp,
      expiresMinutes,
    );
    await this.sendSmsOtp(identifier, sms);
  }

  private async sendEmailOtp(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.resendFromAddress();
    const replyTo = this.replyToOptional();

    if (!apiKey) {
      this.logger.warn(
        `[DEV] Missing RESEND_API_KEY — OTP email to ${to} would say: ${text}`,
      );
      return;
    }

    const resend = new Resend(apiKey);

    let result;
    try {
      result = await resend.emails.send({
        from,
        to: [to],
        subject,
        text,
        ...(replyTo ? { replyTo } : {}),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend OTP email request threw for ${to}: ${msg}`);
      throw new BadGatewayException(
        'Unable to send verification email. Please try again later.',
      );
    }

    if (result.error) {
      this.logger.error(
        `Resend rejected OTP email to ${to}: ${result.error.name} — ${result.error.message} (http ${String(result.error.statusCode)})`,
      );
      throw new BadGatewayException(
        'Unable to send verification email. Check the sender domain in Resend, or try again later.',
      );
    }

    this.logger.log(
      `Verification email accepted by Resend (id=${result.data?.id ?? 'n/a'}) to ${to}`,
    );
  }

  private async sendSmsOtp(to: string, body: string): Promise<void> {
    const username = this.config
      .get<string>('AFRICAS_TALKING_USERNAME')
      ?.trim();
    const apiKey = this.config.get<string>('AFRICAS_TALKING_API_KEY')?.trim();
    const baseUrlRaw =
      this.config.get<string>('AFRICAS_TALKING_BASE_URL')?.trim() ??
      'https://api.africastalking.com';

    if (!username || !apiKey) {
      this.logger.warn(
        `[DEV] Missing Africa's Talking SMS config — OTP SMS to ${to} would say: ${body}`,
      );
      return;
    }

    const baseUrl = baseUrlRaw.replace(/\/+$/, '');
    const url = `${baseUrl}/version1/messaging`;
    /** POST form: username in body per AT docs; we do not send `from`/sender ID. */
    const form = new URLSearchParams({
      username,
      message: body,
      to,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const txt = await res.text();
      this.logger.error(
        `Africa's Talking SMS failed (${res.status}) for recipient ${to}: ${txt}`,
      );
      throw new BadGatewayException(
        "Unable to send verification SMS. Check Africa's Talking username, API key, and base URL (sandbox vs live), then try again.",
      );
    }

    const rawBody = await res.text();
    this.assertAtSmsRecipientsAccepted(to, rawBody, baseUrl);
  }

  /**
   * AT often returns HTTP 200 with failure details inside JSON Recipients[].status / statusCode.
   * Sandbox may also accept requests without delivering to all real handset numbers — check dashboard.
   */
  private assertAtSmsRecipientsAccepted(
    to: string,
    rawBody: string,
    baseUrl: string,
  ): void {
    let payload: AtSmsResponse;
    try {
      payload = rawBody ? (JSON.parse(rawBody) as AtSmsResponse) : {};
    } catch {
      this.logger.warn(
        `Africa's Talking returned non-JSON body for ${to}: ${rawBody.slice(0, 500)}`,
      );
      throw new BadGatewayException(
        "SMS provider returned an unexpected response. Check Africa's Talking logs for this request.",
      );
    }

    const recipients = payload.SMSMessageData?.Recipients ?? [];
    if (recipients.length === 0) {
      this.logger.error(
        `Africa's Talking 200 but no Recipients array; body=${rawBody.slice(0, 800)}`,
      );
      throw new BadGatewayException(
        "SMS was not queued for delivery. Verify phone format and Africa's Talking account settings.",
      );
    }

    const summary = payload.SMSMessageData?.Message ?? '';
    let allOk = true;
    const details: string[] = [];

    for (const r of recipients) {
      const ok = this.atRecipientIndicatesSuccess(r);
      if (!ok) {
        allOk = false;
        details.push(
          `number=${r.number ?? '?'} status=${r.status ?? '?'} statusCode=${String(r.statusCode)}`,
        );
      }
    }

    if (!allOk) {
      this.logger.error(
        `Africa's Talking rejected or failed recipients for ${to}: ${details.join('; ')} summary="${summary}" body=${rawBody.slice(0, 1200)}`,
      );
      throw new BadGatewayException(
        "SMS could not be delivered to this number. Check formatting (international format), sandbox vs live wallet, blacklist, or route — see logs for Africa's Talking recipient status.",
      );
    }

    if (baseUrl.includes('sandbox')) {
      this.logger.warn(
        `Africa's Talking sandbox accepted SMS for ${to}. Sandbox often does not deliver to real phones; use live credentials and wallet for handset delivery.`,
      );
    }

    this.logger.log(
      `OTP SMS Africa's Talking for ${to}: ${summary}. Recipients detail: ${JSON.stringify(recipients)}`,
    );
  }

  /** Per AT payloads: 101 Sent, 102 Success/Queued variants; status string when present. */
  private atRecipientIndicatesSuccess(r: AtSmsRecipient): boolean {
    const code = r.statusCode;
    if (code !== undefined) {
      if (code >= 400 || [403, 404, 405, 406, 407, 500, 501].includes(code)) {
        return false;
      }
      if ([100, 101, 102].includes(code)) {
        return true;
      }
    }
    const s = (r.status ?? '').toLowerCase();
    if (
      ['success', 'sent', 'queued', 'buffered', 'processed', 'submitted'].some(
        (w) => s.includes(w),
      )
    ) {
      return true;
    }
    if (
      [
        'invalid',
        'fail',
        'reject',
        'error',
        'blacklist',
        'insufficient',
        'route',
      ].some((w) => s.includes(w))
    ) {
      return false;
    }
    return code === undefined ? false : code < 400;
  }
}

function emailOtpContent(
  purpose: OtpPurpose,
  language: PreferredLanguage,
  otp: string,
  minutes: number,
): { subject: string; text: string } {
  if (purpose === OtpPurpose.PASSWORD_RESET) {
    return language === PreferredLanguage.FRE
      ? {
          subject: 'Réinitialisez votre mot de passe Joballa',
          text: [
            'Bonjour,',
            '',
            'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Joballa. Saisissez ce code dans l’application :',
            '',
            otp,
            '',
            `Ce code expire dans ${minutes} minutes. S’il expire, retournez à Mot de passe oublié et demandez un nouveau code.`,
            '',
            'Ne partagez pas ce code. L’équipe Joballa ne vous le demandera jamais.',
            '',
            'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message — votre mot de passe ne changera pas.',
            '',
            '— L’équipe Joballa',
          ].join('\n'),
        }
      : {
          subject: 'Reset your Joballa password',
          text: [
            'Hi,',
            '',
            'We received a request to reset the password for your Joballa account. Use this code in the app:',
            '',
            otp,
            '',
            `This code expires in ${minutes} minutes. If it expires, go back to Forgot password and request a new code.`,
            '',
            'Do not share this code. Joballa staff will never ask you for it.',
            '',
            "If you didn't request a reset, you can ignore this email — your password will stay the same.",
            '',
            '— The Joballa team',
          ].join('\n'),
        };
  }

  // REGISTRATION
  return language === PreferredLanguage.FRE
    ? {
        subject: 'Votre code de vérification Joballa',
        text: [
          'Bonjour,',
          '',
          'Merci de vous inscrire sur Joballa. Saisissez ce code de vérification dans l’application pour continuer :',
          '',
          otp,
          '',
          `Ce code expire dans ${minutes} minutes. S’il expire, vous pouvez en demander un nouveau depuis l’écran d’inscription.`,
          '',
          'Ne partagez ce code avec personne. Joballa ne vous le demandera jamais par téléphone ou par e-mail.',
          '',
          'Si vous n’avez pas tenté de créer un compte Joballa, ignorez ce message.',
          '',
          '— L’équipe Joballa',
        ].join('\n'),
      }
    : {
        subject: 'Your Joballa verification code',
        text: [
          'Hi,',
          '',
          'Thanks for signing up for Joballa. Enter this verification code in the app to continue:',
          '',
          otp,
          '',
          `This code expires in ${minutes} minutes. If it expires, you can request a new one from the sign-up screen.`,
          '',
          'Do not share this code with anyone. Joballa will never ask you for it by phone or email.',
          '',
          "If you didn't try to create a Joballa account, you can safely ignore this message.",
          '',
          '— The Joballa team',
        ].join('\n'),
      };
}

function smsOtpContent(
  purpose: OtpPurpose,
  language: PreferredLanguage,
  otp: string,
  minutes: number,
): string {
  if (purpose === OtpPurpose.PASSWORD_RESET) {
    return language === PreferredLanguage.FRE
      ? `Joballa : réinitialisation : ${otp}. Expire dans ${minutes} min. Ignorez si ce n'est pas vous.`
      : `Joballa password reset: ${otp}. Expires in ${minutes} min. Ignore if this wasn't you.`;
  }
  return language === PreferredLanguage.FRE
    ? `Joballa : Votre code est ${otp}. Expire dans ${minutes} min. Ne le partagez pas.`
    : `Joballa: Your code is ${otp}. Expires in ${minutes} min. Don't share it.`;
}
