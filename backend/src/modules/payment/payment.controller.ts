import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentService } from './payment.service';
import { AdminTopupDto, BonusDto, CashInDto, CashPostDto, CheckoutDto, MockTopupDto, RedeemBonusDto } from './dto';
import { AuthUser, CurrentUser, Public, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

@Controller()
export class PaymentController {
  constructor(private payments: PaymentService) {}

  @Post('payments/mock-topup')
  mockTopup(@CurrentUser() user: AuthUser, @Body() dto: MockTopupDto) {
    return this.payments.mockTopup(user.id, dto.amountKopecks);
  }

  @Post('payments/checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.payments.checkout(user.id, dto.amountKopecks, dto.method);
  }

  @Post('payments/:id/sandbox-complete')
  sandboxComplete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.sandboxComplete(id, user.id);
  }

  @Public()
  @Post('payments/webhooks/bepaid')
  webhook(@Body() body: Record<string, any>) {
    return this.payments.webhookBepaid({
      uid: body.uid ?? body.transaction?.uid ?? body.token,
      status: body.status ?? body.transaction?.status,
      amount: body.amount ?? body.transaction?.amount,
    });
  }

  @Get('payments/:id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payments.get(id, user.id);
  }

  @Get('clubs/:clubId/cash-ops')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  cashOps(@Param('clubId') clubId: string, @Query('status') status?: string) {
    return this.payments.listCash(clubId, status);
  }

  @Post('clubs/:clubId/cash-ops')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  cashIn(@Param('clubId') clubId: string, @CurrentUser() user: AuthUser, @Body() dto: CashInDto) {
    return this.payments.drawerIn(clubId, user.id, dto);
  }

  @Post('clubs/:clubId/cash-ops/:opId/post')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  cashPost(
    @Param('clubId') clubId: string,
    @Param('opId') opId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CashPostDto,
  ) {
    return this.payments.postCash(clubId, user.id, opId, dto);
  }

  @Post('clubs/:clubId/cash-ops/:opId/void')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  cashVoid(@Param('clubId') clubId: string, @Param('opId') opId: string, @CurrentUser() user: AuthUser) {
    return this.payments.voidCash(clubId, user.id, opId);
  }

  @Post('clubs/:clubId/wallets/:userId/topup')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  adminTopup(
    @Param('clubId') clubId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AdminTopupDto,
  ) {
    return this.payments.creditAfterRegister(
      clubId,
      user.id,
      userId,
      dto.amountKopecks,
      dto.description ?? 'принято в кассе, зачисление с сайта',
    );
  }

  @Post('clubs/:clubId/wallets/:userId/bonus')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  bonus(@Param('userId') userId: string, @Body() dto: BonusDto) {
    return this.payments.grantBonus(userId, dto.amountKopecks, dto.description);
  }

  @Post('me/wallet/redeem-bonus')
  redeem(@CurrentUser() user: AuthUser, @Body() dto: RedeemBonusDto) {
    return this.payments.redeemBonus(user.id, dto.amountKopecks);
  }

  @Get('me/wallet')
  wallet(@CurrentUser() user: AuthUser) {
    return this.payments.wallet(user.id);
  }

  @Get('me/transactions')
  history(@CurrentUser() user: AuthUser) {
    return this.payments.history(user.id);
  }
}
