"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhoneController = void 0;
const twilio_1 = require("../services/twilio");
const logger_1 = require("../utils/logger");
class PhoneController {
    twilioService;
    constructor() {
        this.twilioService = new twilio_1.TwilioService();
    }
    purchasePhoneNumber = async (request, reply) => {
        const logger = (0, logger_1.createContextualLogger)({
            tenantId: request.tenantId,
            userId: request.userId,
            requestId: `purchase_${Date.now()}`
        });
        try {
            const body = request.body;
            const { agentId, areaCode, country = 'US' } = body;
            logger.info({ agentId, areaCode, country }, 'Purchasing phone number');
            const phoneNumber = await this.twilioService.purchasePhoneNumber(request.tenantId, agentId, areaCode, country);
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
        }
        catch (error) {
            (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'purchase_phone_number' });
            reply.code(500).send({
                success: false,
                error: 'Failed to purchase phone number',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
    listPhoneNumbers = async (request, reply) => {
        const logger = (0, logger_1.createContextualLogger)({
            tenantId: request.tenantId,
            userId: request.userId,
            requestId: `list_phones_${Date.now()}`
        });
        try {
            logger.info('Listing phone numbers');
            const twilioNumbers = await this.twilioService.listPhoneNumbers();
            reply.send({
                success: true,
                data: twilioNumbers,
                message: 'Phone numbers retrieved successfully'
            });
        }
        catch (error) {
            (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'list_phone_numbers' });
            reply.code(500).send({
                success: false,
                error: 'Failed to list phone numbers',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
    updatePhoneNumber = async (request, reply) => {
        const logger = (0, logger_1.createContextualLogger)({
            tenantId: request.tenantId,
            userId: request.userId,
            requestId: `update_phone_${Date.now()}`
        });
        try {
            const params = request.params;
            const body = request.body;
            const { phoneId } = params;
            const { agentId, active } = body;
            logger.info({ phoneId, agentId, active }, 'Updating phone number');
            const twilioSid = phoneId;
            if (agentId) {
                await this.twilioService.updatePhoneNumberAgent(twilioSid, agentId);
            }
            reply.send({
                success: true,
                message: 'Phone number updated successfully'
            });
        }
        catch (error) {
            (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'update_phone_number' });
            reply.code(500).send({
                success: false,
                error: 'Failed to update phone number',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
    releasePhoneNumber = async (request, reply) => {
        const logger = (0, logger_1.createContextualLogger)({
            tenantId: request.tenantId,
            userId: request.userId,
            requestId: `release_phone_${Date.now()}`
        });
        try {
            const params = request.params;
            const { phoneId } = params;
            logger.info({ phoneId }, 'Releasing phone number');
            const twilioSid = phoneId;
            await this.twilioService.releasePhoneNumber(twilioSid);
            reply.send({
                success: true,
                message: 'Phone number released successfully'
            });
        }
        catch (error) {
            (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'release_phone_number' });
            reply.code(500).send({
                success: false,
                error: 'Failed to release phone number',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
}
exports.PhoneController = PhoneController;
//# sourceMappingURL=phoneController.js.map