import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { SocialService } from './social.service';
import { AuthUser, CurrentUser, Public, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

class FriendRequestDto {
  @IsString()
  userId: string;
}

class IssueCardDto {
  @IsString()
  userId: string;
  @IsString()
  cardNumber: string;
  @IsString()
  @MinLength(4)
  pin: string;
}

class ChangePinDto {
  @IsString()
  cardNumber: string;
  @IsString()
  oldPin: string;
  @IsString()
  @MinLength(4)
  newPin: string;
}

@Controller()
export class SocialController {
  constructor(private social: SocialService) {}

  @Public()
  @Get('achievements')
  catalog() {
    return this.social.catalog();
  }

  @Get('me/achievements')
  mine(@CurrentUser() user: AuthUser) {
    return this.social.mine(user.id);
  }

  @Public()
  @Get('users/:userId/public')
  profile(@Param('userId') userId: string) {
    return this.social.publicProfile(userId);
  }

  @Get('me/friends')
  friends(@CurrentUser() user: AuthUser) {
    return this.social.friends(user.id);
  }

  @Post('me/friends')
  request(@CurrentUser() user: AuthUser, @Body() dto: FriendRequestDto) {
    return this.social.request(user.id, dto.userId);
  }

  @Post('me/friends/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.social.accept(user.id, id);
  }

  @Post('me/friends/:id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.social.decline(user.id, id);
  }

  @Post('me/friends/:id/block')
  block(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.social.block(user.id, id);
  }

  @Get('clubs/:clubId/guest-cards')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  cards(@Param('clubId') clubId: string) {
    return this.social.listCards(clubId);
  }

  @Get('clubs/:clubId/guest-cards/:cardNumber')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  card(@Param('clubId') clubId: string, @Param('cardNumber') cardNumber: string) {
    return this.social.getCard(clubId, cardNumber);
  }

  @Post('clubs/:clubId/guest-cards')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  issue(@Body() dto: IssueCardDto) {
    return this.social.issueCard(dto.userId, dto.cardNumber, dto.pin);
  }

  @Post('me/guest-card/pin')
  changePin(@CurrentUser() user: AuthUser, @Body() dto: ChangePinDto) {
    return this.social.changePin(user.id, dto.cardNumber, dto.oldPin, dto.newPin);
  }
}
