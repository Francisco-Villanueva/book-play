import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import jwtConfig from '../../config/jwt.config';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { passwordResetTokenProvider } from './password-reset-token.provider';

@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    UsersModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'default-dev-secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    ...passwordResetTokenProvider,
  ],
  exports: [AuthService],
})
export class AuthModule {}
