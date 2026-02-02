import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.model';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
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
      throw new Error('Invalid credentials');
    }
    return this.generateAuthResponse(user);
  }

  private generateAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: user.toJSON(),
    };
  }
}
