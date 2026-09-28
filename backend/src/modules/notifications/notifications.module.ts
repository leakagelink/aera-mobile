import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AdminModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}