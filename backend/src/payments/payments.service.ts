import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaystackWebhookLog } from './entities/paystack-webhook-log.entity';
import { User } from '../auth/entities/user.entity';
import { CreatePaymentDto, UpdatePaymentDto, VerifyPaymentFromVercelDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaystackWebhookLog)
    private webhookLogRepository: Repository<PaystackWebhookLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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

  async getActiveSubscription(userId: string): Promise<any> {
    // Get user details
    const user = await this.userRepository.findOne({ where: { id: userId } });

    // Admin users always get premium
    if (user && user.is_admin) {
      return {
        payment_status: 'paid',
        subscription_tier: 'premium',
        expires_at: null, // No expiry for admin
        trial_ends_at: null,
        is_active: true,
      };
    }

    const now = new Date();
    const payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.user_id = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'success' })
      .andWhere('payment.subscription_end > :now', { now })
      .orderBy('payment.subscription_end', 'DESC')
      .getOne();

    // Transform Payment entity to subscription response format
    if (!payment) {
      return {
        payment_status: 'free',
        subscription_tier: 'free',
        expires_at: null,
        trial_ends_at: null,
        is_active: false,
      };
    }

    // Determine subscription tier from subscription_plan
    let tier: 'free' | 'premium' | 'pro' = 'free';
    if (payment.subscription_plan === 'pro') {
      tier = 'pro';
    } else if (payment.subscription_plan === 'premium') {
      tier = 'premium';
    }

    return {
      payment_status: 'paid',
      subscription_tier: tier,
      expires_at: payment.subscription_end,
      trial_ends_at: null,
      is_active: payment.subscription_end ? payment.subscription_end > now : false,
    };
  }

  async restorePurchase(userId: string): Promise<any> {
    // Find latest successful payment for this user
    const payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.user_id = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'success' })
      .orderBy('payment.paid_at', 'DESC')
      .getOne();

    if (!payment) {
      return {
        success: false,
        message: 'No successful purchases found for this account',
        data: {
          tier: 'free',
        },
      };
    }

    // Determine subscription tier
    let tier: 'free' | 'premium' | 'pro' = 'premium';
    if (payment.subscription_plan === 'pro') {
      tier = 'pro';
    } else if (payment.subscription_plan === 'free') {
      tier = 'free';
    }

    // Calculate expiry date
    let expiryDate = payment.subscription_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (typeof expiryDate === 'string') {
      expiryDate = new Date(expiryDate);
    }

    return {
      success: true,
      message: 'Purchase restored successfully',
      data: {
        tier,
        paymentDate: payment.created_at || new Date(),
        expiryDate,
        amount: payment.amount,
        reference: payment.reference,
      },
    };
  }

  async createOrUpdatePaymentFromVercel(dto: VerifyPaymentFromVercelDto): Promise<any> {
    // Check if payment already exists
    let payment = await this.findByReference(dto.reference);

    const now = new Date();
    const expiryDate = new Date(dto.expiresAt);

    if (payment) {
      // Update existing payment
      payment.status = 'success';
      payment.amount = dto.amount;
      payment.currency = dto.currency;
      payment.subscription_plan = dto.tier;
      payment.subscription_tier = dto.tier;
      payment.subscription_start = now;
      payment.subscription_end = expiryDate;
      payment.paid_at = now;
      payment.paystack_customer_code = dto.paystack_customer_code || null;
      payment.metadata = dto.metadata;
      payment.updated_at = now;
    } else {
      // Create new payment
      payment = this.paymentRepository.create({
        user_id: dto.userId,
        reference: dto.reference,
        paystack_reference: dto.reference,
        amount: dto.amount,
        currency: dto.currency,
        status: 'success',
        payment_method: 'paystack',
        subscription_plan: dto.tier,
        subscription_tier: dto.tier,
        subscription_start: now,
        subscription_end: expiryDate,
        subscription_duration: 30,
        paid_at: now,
        paystack_customer_code: dto.paystack_customer_code,
        metadata: dto.metadata,
      });
    }

    const savedPayment = await this.paymentRepository.save(payment);

    return {
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        paymentId: savedPayment.id,
        tier: dto.tier,
        expiresAt: expiryDate.toISOString(),
      },
    };
  }
}
