import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuthUser, CurrentUser } from '../../common/decorators';

@Controller('notifications')
export class NotificationController {
  constructor(private notifications: NotificationService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id);
  }

  @Patch(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('test')
  test(@CurrentUser() user: AuthUser, @Body() body: { title?: string; body?: string }) {
    return this.notifications.push(
      user.id,
      'test',
      body.title ?? 'RUDEMIR',
      body.body ?? 'Тестовое уведомление',
    );
  }
}
