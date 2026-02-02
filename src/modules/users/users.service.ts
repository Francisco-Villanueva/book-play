import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.model';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  async create(data: {
    name: string;
    email: string;
    password: string;
    userName: string;
    phone?: string;
    globalRole?: string;
  }): Promise<User> {
    const existing = await this.userModel.findOne({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password = await bcrypt.hash(data.password, 10);
    return this.userModel.create({
      name: data.name,
      email: data.email,
      password,
      userName: data.userName,
      phone: data.phone,
      globalRole: data.globalRole,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
  }

  async findByUsernameOrEmail(username: string): Promise<User | null> {
    return this.userModel.findOne({
      where: {
        [Op.or]: [{ userName: username }, { email: username }],
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
