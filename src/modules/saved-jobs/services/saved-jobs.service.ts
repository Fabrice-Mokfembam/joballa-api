import { Injectable } from '@nestjs/common';
import { SavedJobsRepository } from '../repositories/saved-jobs.repository';

@Injectable()
export class SavedJobsService {
  constructor(private readonly savedJobsRepository: SavedJobsRepository) {}

  getSavedJobs(workerId: string, page = 1, limit = 20) {
    return this.savedJobsRepository.getSavedJobs(workerId, page, limit);
  }

  deleteSavedJob(workerId: string, jobId: string) {
    return this.savedJobsRepository.deleteSavedJob(workerId, jobId);
  }

  deleteSavedJobsInBulk(workerId: string, jobIds: string[]) {
    return this.savedJobsRepository.deleteSavedJobsInBulk(workerId, jobIds);
  }
}
