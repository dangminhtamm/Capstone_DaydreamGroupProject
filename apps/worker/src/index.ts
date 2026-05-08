import 'dotenv/config';

import { SummaryPipelineJob } from './jobs/summary/index';

SummaryPipelineJob.startCron();
