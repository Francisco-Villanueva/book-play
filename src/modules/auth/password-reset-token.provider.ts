import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../database/constants/repositories.constants';
import { PasswordResetToken } from './entities/password-reset-token.model';

export const passwordResetTokenProvider = [
  {
    provide: PASSWORD_RESET_TOKEN_REPOSITORY,
    useValue: PasswordResetToken,
  },
];
