import 'dotenv/config';

import { SummaryPipelineJob } from './jobs/sumary/index';

SummaryPipelineJob.startCron();
