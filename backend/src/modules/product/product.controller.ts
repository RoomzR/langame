import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ProductService } from './product.service';
import { AuthUser, CurrentUser, Public, RequireClubRole } from '../../common/decorators';
import { ClubGuard } from '../../common/club.guard';

class CreateProductDto {
  @IsString()
  name: string;
  @IsInt()
  @Min(0)
  priceKopecks: number;
  @IsOptional()
  @IsString()
  category?: string;
}

class OrderItemDto {
  @IsString()
  productId: string;
  @IsInt()
  @Min(1)
  qty: number;
}

class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsOptional()
  @IsString()
  seatId?: string;
  @IsOptional()
  @IsString()
  userId?: string;
}

class OrderStatusDto {
  @IsIn(['PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
  status: 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
}

@Controller()
export class ProductController {
  constructor(private products: ProductService) {}

  @Public()
  @Get('clubs/:clubId/products')
  list(@Param('clubId') clubId: string) {
    return this.products.list(clubId);
  }

  @Post('clubs/:clubId/products')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  create(@Param('clubId') clubId: string, @Body() dto: CreateProductDto) {
    return this.products.create(clubId, dto);
  }

  @Post('clubs/:clubId/orders')
  order(
    @Param('clubId') clubId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.products.order(clubId, dto.userId ?? user.id, dto.items, dto.seatId);
  }

  @Get('clubs/:clubId/orders')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  orders(@Param('clubId') clubId: string) {
    return this.products.orders(clubId);
  }

  @Post('clubs/:clubId/orders/:orderId/status')
  @RequireClubRole(UserRole.OWNER, UserRole.CLUB_ADMIN)
  @UseGuards(ClubGuard)
  status(@Param('clubId') clubId: string, @Param('orderId') orderId: string, @Body() dto: OrderStatusDto) {
    return this.products.setOrderStatus(clubId, orderId, dto.status);
  }
}
