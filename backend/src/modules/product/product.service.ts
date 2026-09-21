import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  list(clubId: string) {
    return this.prisma.product.findMany({ where: { clubId, isActive: true } });
  }

  create(clubId: string, data: { name: string; priceKopecks: number; category?: string }) {
    return this.prisma.product.create({ data: { clubId, ...data } });
  }

  orders(clubId: string) {
    return this.prisma.order.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: { include: { product: { select: { name: true } } } },
        user: { select: { displayName: true, phone: true } },
      },
    });
  }

  async setOrderStatus(clubId: string, orderId: string, status: 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED') {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, clubId } });
    if (!order) throw new BadRequestException({ code: 'ORDER_NOT_FOUND' });
    return this.prisma.order.update({ where: { id: orderId }, data: { status } });
  }

  async order(
    clubId: string,
    userId: string,
    items: { productId: string; qty: number }[],
    seatId?: string,
  ) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, clubId },
    });
    if (!products.length) throw new BadRequestException({ code: 'EMPTY_ORDER' });
    const lines = items.map((i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p) throw new BadRequestException({ code: 'PRODUCT_NOT_FOUND' });
      return { productId: p.id, qty: i.qty, priceKopecks: p.priceKopecks };
    });
    const total = lines.reduce((s, l) => s + l.priceKopecks * l.qty, 0);
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceKopecks < total) {
      throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS' });
    }
    const order = await this.prisma.order.create({
      data: {
        clubId,
        userId,
        seatId,
        totalKopecks: total,
        items: { create: lines },
      },
      include: { items: true },
    });
    await this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceKopecks: { decrement: total } },
    });
    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        amountKopecks: -total,
        type: TransactionType.PURCHASE,
        orderId: order.id,
        description: 'Bar / merch order',
      },
    });
    return order;
  }
}
