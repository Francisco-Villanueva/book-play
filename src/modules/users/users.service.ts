import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.model';
import { USER_REPOSITORY } from '../database/constants/repositories.constants';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userModel: typeof User,
  ) {}

  async create(data: RegisterDto): Promise<User> {
    const existingEmail = await this.userModel.findOne({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }
    const existingUserName = await this.userModel.findOne({
      where: { userName: data.userName },
    });
    if (existingUserName) {
      throw new ConflictException('Username already registered');
    }

    const password = await bcrypt.hash(data.password, 10);

    return this.userModel.create({
      ...data,
      password,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userModel.findOne({ where: { email } });
  }

  async findByUsernameOrEmail(username: string): Promise<User | null> {
    return await this.userModel.findOne({
      where: {
        [Op.or]: [{ userName: username }, { email: username }],
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return await this.userModel.findByPk(id);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    const res = await bcrypt.compare(plainPassword, hashedPassword);
    return res;
  }
}
