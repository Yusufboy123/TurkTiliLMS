import { passwordService } from '../auth/auth.container.js';
import { NodeStepUpCryptoService } from './step-up-crypto.service.js';
import { StepUpAuthenticationController } from './step-up-authentication.controller.js';
import { PrismaStepUpRepository } from './step-up-authentication.repository.js';
import { StepUpAuthenticationService } from './step-up-authentication.service.js';

export const stepUpAuthenticationService = new StepUpAuthenticationService(
  new PrismaStepUpRepository(),
  passwordService,
  new NodeStepUpCryptoService(),
);

export const stepUpAuthenticationController = new StepUpAuthenticationController(
  stepUpAuthenticationService,
);
