import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ClubGuard } from '../../common/club.guard';

@Module({
  controllers: [ProductController],
  providers: [ProductService, ClubGuard],
})
export class ProductModule {}
