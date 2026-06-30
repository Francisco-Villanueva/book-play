import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { Business } from '../businesses/entities/business.model';
import { USER_REPOSITORY } from '../database/constants/repositories.constants';
import { GlobalRole } from '../../common/enums';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
      globalRole: GlobalRole.PLAYER, // always forced — clients cannot self-elevate
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

  async findByIdWithBusinesses(id: string): Promise<User | null> {
    return this.userModel.findByPk(id, {
      include: [
        {
          model: BusinessUser,
          as: 'businessUsers',
          include: [
            {
              model: Business,
              as: 'business',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (!dto.name && !dto.phone) {
      throw new BadRequestException(
        'At least one field (name or phone) is required',
      );
    }

    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await user.update(dto);
    return user;
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    const res = await bcrypt.compare(plainPassword, hashedPassword);
    return res;
  }
}
