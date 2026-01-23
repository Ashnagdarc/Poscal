import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaystackWebhookLog } from './entities/paystack-webhook-log.entity';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaystackWebhookLog)
    private webhookLogRepository: Repository<PaystackWebhookLog>,
  ) {}

  async findAll(userId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByReference(reference: string): Promise<Payment | null> {
    return await this.paymentRepository.findOne({ where: { reference } });
  }

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentRepository.create(createPaymentDto);
    return await this.paymentRepository.save(payment);
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findOne(id);
    Object.assign(payment, updatePaymentDto);
    return await this.paymentRepository.save(payment);
  }

  async verifyPayment(reference: string): Promise<Payment> {
    const payment = await this.findByReference(reference);
    
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // TODO: Call Paystack API to verify payment
    // For now, just return the payment
    return payment;
  }

  async logWebhook(event: string, data: any, status: string, errorMessage?: string, reference?: string): Promise<PaystackWebhookLog> {
    const log = this.webhookLogRepository.create({
      event,
      data,
      status,
      error_message: errorMessage,
      reference,
    });
    return await this.webhookLogRepository.save(log);
  }

  async getWebhookLogs(limit: number = 50): Promise<PaystackWebhookLog[]> {
    return await this.webhookLogRepository.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getActiveSubscription(userId: string): Promise<Payment | null> {
    const now = new Date();
    return await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.user_id = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'success' })
      .andWhere('payment.subscription_end > :now', { now })
      .orderBy('payment.subscription_end', 'DESC')
      .getOne();
  }
}
