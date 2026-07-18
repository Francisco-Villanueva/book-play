import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.model';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../database/constants/repositories.constants';
import { PasswordResetToken } from './entities/password-reset-token.model';

const PASSWORD_RESET_TTL_MINUTES = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenModel: typeof PasswordResetToken,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    void this.mailService.sendWelcomePlayer({
      to: user.email,
      name: user.name,
    });
    return this.generateAuthResponse(user);
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByUsernameOrEmail(username);
    if (!user) return null;
    const valid = await this.usersService.validatePassword(
      password,
      user.password,
    );

    return valid ? user : null;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.generateAuthResponse(user);
  }

  // Respuesta genérica siempre (exista o no el email) para no filtrar qué
  // direcciones están registradas.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000,
    );
    await this.passwordResetTokenModel.create({
      userId: user.id,
      tokenHash: this.hashToken(token),
      expiresAt,
    });
    void this.mailService.sendPasswordReset({
      to: user.email,
      name: user.name,
      token,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.passwordResetTokenModel.findOne({
      where: { tokenHash: this.hashToken(token), usedAt: null },
    });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'El enlace de recuperación no es válido o expiró',
      );
    }

    const user = await this.usersService.setPassword(
      record.userId,
      newPassword,
    );
    await record.update({ usedAt: new Date() });
    void this.mailService.sendPasswordChanged({
      to: user.email,
      name: user.name,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const valid = await this.usersService.validatePassword(
      currentPassword,
      user.password,
    );
    if (!valid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    await this.usersService.setPassword(userId, newPassword);
    void this.mailService.sendPasswordChanged({
      to: user.email,
      name: user.name,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: user.toJSON(),
    };
  }
}
