import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import { FilesService } from '../../files/services/files.service';
import { MAX_GENERATED_CV_BYTES } from '../../files/files.constants';
import {
  cvGenerationFailed,
  generatedCvNotFound,
  profileInsufficientForCv,
} from './worker-cv-export.errors';

const GENERATION_TIMEOUT_MS = 30_000;

type CvProfileBundle = {
  userId: string;
  profileId: string;
  profileUpdatedAt: Date;
  fullName: string;
  professionalTitle: string | null;
  shortBio: string;
  city: string | null;
  region: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  languages: string[];
  skills: string[];
  preferredJobCategories: string[];
  preferredJobTypes: EmploymentType[];
  workExperiences: Array<{
    companyName: string;
    jobTitle: string;
    location: string | null;
    startDate: Date;
    endDate: Date | null;
    isCurrent: boolean;
    description: string | null;
  }>;
  education: Array<{
    institutionName: string;
    degree: string | null;
    fieldOfStudy: string | null;
    startDate: Date;
    endDate: Date | null;
    isCurrent: boolean;
    description: string | null;
  }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    issueDate: Date | null;
    expiryDate: Date | null;
  }>;
  generatedCvUrl: string | null;
  generatedCvPublicId: string | null;
  generatedCvFileName: string | null;
  generatedCvDocumentId: string | null;
  generatedCvAt: Date | null;
  generatedCvSourceProfileUpdatedAt: Date | null;
};

export type CvPdfDelivery = {
  buffer: Buffer;
  fileName: string;
  documentId: string;
  generatedAt: string;
};

@Injectable()
export class WorkerCvExportService {
  private readonly logger = new Logger(WorkerCvExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  async getStatus(user: LocalAuthUser) {
    const bundle = await this.loadProfileBundle(user.id);
    const available = !!bundle.generatedCvUrl && !!bundle.generatedCvAt;
    const sourceUpdatedAt = bundle.generatedCvSourceProfileUpdatedAt;
    const isOutdated =
      available &&
      !!sourceUpdatedAt &&
      bundle.profileUpdatedAt.getTime() > sourceUpdatedAt.getTime();

    return {
      available,
      documentId: bundle.generatedCvDocumentId,
      fileName: bundle.generatedCvFileName,
      generatedAt: bundle.generatedCvAt?.toISOString() ?? null,
      sourceProfileUpdatedAt: sourceUpdatedAt?.toISOString() ?? null,
      isOutdated,
      downloadUrl: available ? '/worker/profile/cv-export' : null,
    };
  }

  async downloadStored(user: LocalAuthUser): Promise<CvPdfDelivery> {
    const bundle = await this.loadProfileBundle(user.id);
    if (!bundle.generatedCvUrl || !bundle.generatedCvFileName) {
      throw generatedCvNotFound();
    }
    const buffer = await this.fetchPdfBuffer(bundle.generatedCvUrl);
    return {
      buffer,
      fileName: bundle.generatedCvFileName,
      documentId: bundle.generatedCvDocumentId ?? bundle.profileId,
      generatedAt:
        bundle.generatedCvAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async generateAndStore(user: LocalAuthUser): Promise<CvPdfDelivery> {
    const bundle = await this.loadProfileBundle(user.id);
    this.assertProfileReady(bundle);

    const previousPublicId = bundle.generatedCvPublicId;
    let buffer: Buffer;

    try {
      buffer = await this.withTimeout(
        this.renderPdf(bundle),
        GENERATION_TIMEOUT_MS,
      );
    } catch (err) {
      this.logger.warn(
        `CV generation failed for worker ${user.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw cvGenerationFailed();
    }

    if (buffer.length === 0 || buffer.length > MAX_GENERATED_CV_BYTES) {
      this.logger.warn(`CV generation size invalid for worker ${user.id}`);
      throw cvGenerationFailed();
    }

    const fileName = buildCvFileName(bundle.fullName);
    const documentId = randomUUID();
    const generatedAt = new Date();

    let upload;
    try {
      upload = await this.filesService.uploadGeneratedCvExport(
        buffer,
        user.id,
        documentId,
      );
    } catch (err) {
      this.logger.warn(
        `CV upload failed for worker ${user.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw cvGenerationFailed();
    }

    try {
      await this.prisma.workerProfile.update({
        where: { userId: user.id },
        data: {
          generatedCvUrl: upload.secureUrl,
          generatedCvPublicId: upload.publicId,
          generatedCvFileName: fileName,
          generatedCvDocumentId: documentId,
          generatedCvAt: generatedAt,
          generatedCvSourceProfileUpdatedAt: bundle.profileUpdatedAt,
        },
      });
    } catch (err) {
      this.logger.error(`CV metadata save failed for worker ${user.id}`, err);
      try {
        await this.filesService.deleteFile(upload.publicId, 'raw');
      } catch {
        /* best effort */
      }
      throw cvGenerationFailed();
    }

    if (previousPublicId && previousPublicId !== upload.publicId) {
      try {
        await this.filesService.deleteFile(previousPublicId, 'raw');
      } catch {
        /* keep new export even if old cleanup fails */
      }
    }

    return {
      buffer,
      fileName,
      documentId,
      generatedAt: generatedAt.toISOString(),
    };
  }

  private assertProfileReady(bundle: CvProfileBundle) {
    if (!bundle.fullName.trim() || !bundle.shortBio.trim()) {
      throw profileInsufficientForCv();
    }
  }

  private async loadProfileBundle(userId: string): Promise<CvProfileBundle> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workerProfile: true,
        workExperiences: { orderBy: { startDate: 'desc' } },
        educationItems: { orderBy: { startDate: 'desc' } },
        certifications: { orderBy: { issueDate: 'desc' } },
      },
    });

    if (!user?.workerProfile) {
      throw profileInsufficientForCv();
    }

    const p = user.workerProfile;
    const fullName =
      p.fullName?.trim() ||
      [p.firstName, p.lastName].filter(Boolean).join(' ').trim();

    return {
      userId: user.id,
      profileId: p.id,
      profileUpdatedAt: p.updatedAt,
      fullName,
      professionalTitle: p.professionalTitle,
      shortBio: p.shortBio?.trim() ?? '',
      city: p.city,
      region: p.region,
      country: p.country,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photoUrl,
      languages: p.languages,
      skills: p.skills,
      preferredJobCategories: p.preferredJobCategories,
      preferredJobTypes: p.preferredJobTypes,
      workExperiences: user.workExperiences.map((w) => ({
        companyName: w.companyName,
        jobTitle: w.jobTitle,
        location: w.location,
        startDate: w.startDate,
        endDate: w.endDate,
        isCurrent: w.isCurrent,
        description: w.description,
      })),
      education: user.educationItems.map((e) => ({
        institutionName: e.institutionName,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        startDate: e.startDate,
        endDate: e.endDate,
        isCurrent: e.isCurrent,
        description: e.description,
      })),
      certifications: user.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
        issueDate: c.issueDate,
        expiryDate: c.expiryDate,
      })),
      generatedCvUrl: p.generatedCvUrl,
      generatedCvPublicId: p.generatedCvPublicId,
      generatedCvFileName: p.generatedCvFileName,
      generatedCvDocumentId: p.generatedCvDocumentId,
      generatedCvAt: p.generatedCvAt,
      generatedCvSourceProfileUpdatedAt: p.generatedCvSourceProfileUpdatedAt,
    };
  }

  private async fetchPdfBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new InternalServerErrorException(
        'Stored CV could not be retrieved.',
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('CV generation timed out')),
        ms,
      );
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async renderPdf(bundle: CvProfileBundle): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      void this.paintPdf(doc, bundle)
        .then(() => doc.end())
        .catch(reject);
    });
  }

  private async paintPdf(
    doc: InstanceType<typeof PDFDocument>,
    bundle: CvProfileBundle,
  ) {
    const photo = bundle.photoUrl
      ? await this.tryFetchImage(bundle.photoUrl)
      : null;
    let headerY = 50;

    if (photo) {
      try {
        doc.image(photo, 50, headerY, { width: 72, height: 72, fit: [72, 72] });
      } catch {
        /* skip photo if unreadable */
      }
    }

    const textX = photo ? 140 : 50;
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(sanitizeText(bundle.fullName), textX, headerY);
    headerY += 28;

    if (bundle.professionalTitle) {
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#333333')
        .text(sanitizeText(bundle.professionalTitle), textX, headerY);
      headerY += 18;
    }

    const location = [bundle.city, bundle.region, bundle.country]
      .filter(Boolean)
      .join(', ');
    if (location) {
      doc
        .fontSize(10)
        .fillColor('#555555')
        .text(sanitizeText(location), textX, headerY);
      headerY += 14;
    }

    const contacts = [bundle.email, bundle.phone].filter(Boolean).join('  •  ');
    if (contacts) {
      doc.text(sanitizeText(contacts), textX, headerY);
      headerY += 14;
    }

    doc.moveDown(1.2);
    doc.fillColor('#000000');

    if (bundle.shortBio) {
      this.sectionHeading(doc, 'Professional Summary');
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(sanitizeText(bundle.shortBio), { align: 'left' });
      doc.moveDown(0.6);
    }

    if (bundle.languages.length) {
      this.sectionHeading(doc, 'Languages');
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(bundle.languages.map(sanitizeText).join(', '));
      doc.moveDown(0.6);
    }

    if (bundle.skills.length) {
      this.sectionHeading(doc, 'Skills');
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(bundle.skills.map(sanitizeText).join(', '));
      doc.moveDown(0.6);
    }

    const prefs = [
      ...bundle.preferredJobCategories.map(sanitizeText),
      ...bundle.preferredJobTypes.map((t) =>
        sanitizeText(employmentTypeLabel(t)),
      ),
    ].filter(Boolean);
    if (prefs.length) {
      this.sectionHeading(doc, 'Preferred Roles');
      doc.font('Helvetica').fontSize(10).text(prefs.join(', '));
      doc.moveDown(0.6);
    }

    if (bundle.workExperiences.length) {
      this.sectionHeading(doc, 'Work Experience');
      for (const w of bundle.workExperiences) {
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`${sanitizeText(w.jobTitle)} — ${sanitizeText(w.companyName)}`);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#555555')
          .text(
            `${formatPeriod(w.startDate, w.endDate, w.isCurrent)}${w.location ? `  •  ${sanitizeText(w.location)}` : ''}`,
          );
        if (w.description?.trim()) {
          doc
            .fillColor('#000000')
            .fontSize(10)
            .text(sanitizeText(w.description));
        }
        doc.moveDown(0.4);
      }
      doc.moveDown(0.2);
    }

    if (bundle.education.length) {
      this.sectionHeading(doc, 'Education');
      for (const e of bundle.education) {
        const line = [e.degree, e.fieldOfStudy]
          .filter(Boolean)
          .map(sanitizeText)
          .join(' — ');
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(sanitizeText(e.institutionName));
        if (line) doc.font('Helvetica').fontSize(10).text(line);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#555555')
          .text(formatPeriod(e.startDate, e.endDate, e.isCurrent));
        if (e.description?.trim()) {
          doc
            .fillColor('#000000')
            .fontSize(10)
            .text(sanitizeText(e.description));
        }
        doc.moveDown(0.4);
      }
      doc.moveDown(0.2);
    }

    if (bundle.certifications.length) {
      this.sectionHeading(doc, 'Certifications');
      for (const c of bundle.certifications) {
        const meta = [
          c.issuer,
          c.issueDate ? formatMonthYear(c.issueDate) : null,
        ]
          .filter(Boolean)
          .map((v) => sanitizeText(String(v)))
          .join('  •  ');
        doc.font('Helvetica-Bold').fontSize(10).text(sanitizeText(c.name));
        if (meta)
          doc.font('Helvetica').fontSize(9).fillColor('#555555').text(meta);
        doc.fillColor('#000000');
        doc.moveDown(0.3);
      }
    }

    doc
      .fontSize(8)
      .fillColor('#888888')
      .text('Generated by Joballa', 50, doc.page.height - 40, {
        align: 'center',
        width: doc.page.width - 100,
      });
  }

  private sectionHeading(doc: InstanceType<typeof PDFDocument>, title: string) {
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f766e').text(title);
    doc.moveDown(0.2);
    doc.fillColor('#000000');
  }

  private async tryFetchImage(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
}

function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

function buildCvFileName(fullName: string): string {
  const slug =
    fullName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'worker';
  return `joballa-cv-${slug}.pdf`;
}

function formatPeriod(
  start: Date,
  end: Date | null,
  isCurrent: boolean,
): string {
  const a = formatMonthYear(start);
  const b = isCurrent ? 'Present' : end ? formatMonthYear(end) : '';
  return b ? `${a} — ${b}` : a;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function employmentTypeLabel(value: EmploymentType): string {
  return value.toLowerCase().replace(/_/g, ' ');
}
