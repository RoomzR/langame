import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Max, Min } from 'class-validator';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, CurrentUser, Public } from '../../common/decorators';

class ReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
  @IsOptional()
  @IsString()
  text?: string;
}

@Controller('clubs/:clubId')
export class ExtraClubController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('apps')
  apps(@Param('clubId') clubId: string) {
    return this.prisma.clubApp.findMany({ where: { clubId }, orderBy: { sortOrder: 'asc' } });
  }

  @Public()
  @Get('reviews')
  reviews(@Param('clubId') clubId: string) {
    return this.prisma.review.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { displayName: true } } },
    });
  }

  @Post('reviews')
  async review(
    @Param('clubId') clubId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewDto,
  ) {
    const review = await this.prisma.review.upsert({
      where: { clubId_userId: { clubId, userId: user.id } },
      update: { rating: dto.rating, text: dto.text ?? '' },
      create: { clubId, userId: user.id, rating: dto.rating, text: dto.text ?? '' },
    });
    const agg = await this.prisma.review.aggregate({
      where: { clubId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.club.update({
      where: { id: clubId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });
    return review;
  }
}
