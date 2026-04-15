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
    private paystackWebhookLogRepository: Repository<PaystackWebhookLog>,
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
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const subscriptionEnd = new Date(dto.expiresAt);
    if (Number.isNaN(subscriptionEnd.getTime())) {
      throw new Error('Invalid expiresAt value');
    }

    let payment = await this.paymentRepository.findOne({
      where: [{ reference: dto.reference }, { paystack_reference: dto.reference }],
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        user_id: dto.userId,
        reference: dto.reference,
        paystack_reference: dto.reference,
        amount: Number(dto.amount) / 100,
        currency: dto.currency || 'NGN',
        tier: dto.tier,
        subscription_tier: dto.tier,
        status: 'success',
        payment_method: 'paystack',
        paystack_customer_code: dto.paystack_customer_code || null,
        subscription_plan: dto.tier,
        subscription_start: now,
        subscription_end: subscriptionEnd,
        paid_at: now,
        metadata: dto.metadata || null,
      });
    } else {
      payment.status = 'success';
      payment.currency = dto.currency || payment.currency || 'NGN';
      payment.tier = dto.tier;
      payment.subscription_tier = dto.tier;
      payment.payment_method = 'paystack';
      payment.reference = dto.reference;
      payment.paystack_reference = dto.reference;
      payment.amount = Number(dto.amount) / 100;
      payment.paystack_customer_code = dto.paystack_customer_code || payment.paystack_customer_code;
      payment.subscription_plan = dto.tier;
      payment.subscription_start = payment.subscription_start || now;
      payment.subscription_end = subscriptionEnd;
      payment.paid_at = now;
      payment.metadata = {
        ...(payment.metadata || {}),
        ...(dto.metadata || {}),
      };
    }

    const savedPayment = await this.paymentRepository.save(payment);

    user.subscription_tier = dto.tier;
    user.subscription_expires_at = subscriptionEnd;
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        paymentId: savedPayment.id,
        reference: savedPayment.reference,
        tier: dto.tier,
        expiresAt: subscriptionEnd.toISOString(),
      },
    };
  }

  async logWebhook(
    event: string,
    data: any,
    status: string,
    errorMessage?: string,
    reference?: string,
  ): Promise<PaystackWebhookLog> {
    const log = this.paystackWebhookLogRepository.create({
      event,
      data,
      status,
      error_message: errorMessage || null,
      reference: reference || null,
    });

    return await this.paystackWebhookLogRepository.save(log);
  }

  async getWebhookLogs(limit = 50): Promise<PaystackWebhookLog[]> {
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), 200)) : 50;
    return await this.paystackWebhookLogRepository.find({
      order: { created_at: 'DESC' },
      take: safeLimit,
    });
  }

}
