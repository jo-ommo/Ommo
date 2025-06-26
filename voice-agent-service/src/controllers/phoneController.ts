import type { FastifyRequest, FastifyReply } from 'fastify';
import { TwilioService } from '../services/twilio';
import { createContextualLogger, logError } from '../utils/logger';
import type { PhoneNumber } from '../types';

interface AuthenticatedRequest extends FastifyRequest {
  tenantId: string;
  userId: string;
}

interface PurchasePhoneRequest extends AuthenticatedRequest {
  Body: {
    agentId: string;
    areaCode?: string;
    country?: string;
  };
}

interface UpdatePhoneRequest extends AuthenticatedRequest {
  Params: {
    phoneId: string;
  };
  Body: {
    agentId?: string;
    active?: boolean;
  };
}

export class PhoneController {
  private twilioService: TwilioService;

  constructor() {
    this.twilioService = new TwilioService();
  }

  public purchasePhoneNumber = async (
    request: PurchasePhoneRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `purchase_${Date.now()}`
    });

    try {
      const body = request.body as { agentId: string; areaCode?: string; country?: string };
      const { agentId, areaCode, country = 'US' } = body;

      logger.info({ agentId, areaCode, country }, 'Purchasing phone number');

      const phoneNumber = await this.twilioService.purchasePhoneNumber(
        request.tenantId,
        agentId,
        areaCode,
        country
      );

      logger.info({ 
        phoneNumberId: phoneNumber.id,
        phoneNumber: phoneNumber.phoneNumber,
        twilioSid: phoneNumber.twilioSid
      }, 'Phone number purchased successfully');

      reply.code(201).send({
        success: true,
        data: phoneNumber,
        message: 'Phone number purchased successfully'
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'purchase_phone_number' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to purchase phone number',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public listPhoneNumbers = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `list_phones_${Date.now()}`
    });

    try {
      logger.info('Listing phone numbers');

      // TODO: Implement database storage and retrieval
      // For now, return mock data or Twilio numbers
      const twilioNumbers = await this.twilioService.listPhoneNumbers();

      reply.send({
        success: true,
        data: twilioNumbers,
        message: 'Phone numbers retrieved successfully'
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'list_phone_numbers' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to list phone numbers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public updatePhoneNumber = async (
    request: UpdatePhoneRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `update_phone_${Date.now()}`
    });

    try {
      const params = request.params as { phoneId: string };
      const body = request.body as { agentId?: string; active?: boolean };
      const { phoneId } = params;
      const { agentId, active } = body;

      logger.info({ phoneId, agentId, active }, 'Updating phone number');

      // TODO: Get phone number from database
      // For now, assume we have the twilioSid
      const twilioSid = phoneId; // This should be retrieved from database

      if (agentId) {
        await this.twilioService.updatePhoneNumberAgent(twilioSid, agentId);
      }

      // TODO: Update database record

      reply.send({
        success: true,
        message: 'Phone number updated successfully'
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'update_phone_number' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to update phone number',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public releasePhoneNumber = async (
    request: UpdatePhoneRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `release_phone_${Date.now()}`
    });

    try {
      const params = request.params as { phoneId: string };
      const { phoneId } = params;

      logger.info({ phoneId }, 'Releasing phone number');

      // TODO: Get phone number from database
      const twilioSid = phoneId; // This should be retrieved from database

      await this.twilioService.releasePhoneNumber(twilioSid);

      // TODO: Update database record to mark as inactive

      reply.send({
        success: true,
        message: 'Phone number released successfully'
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'release_phone_number' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to release phone number',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
} 