import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { USER_REPOSITORY } from '../database/constants/repositories.constants';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  const mockUserModel = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: USER_REPOSITORY, useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      name: 'John',
      email: 'john@test.com',
      password: 'password123',
      userName: 'johndoe',
    };

    it('should create a user with hashed password', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = { id: 'uuid-1', ...dto, password: 'hashed' };
      mockUserModel.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed', email: 'john@test.com' }),
      );
      expect(result).toEqual(created);
    });

    it('should throw ConflictException if email exists', async () => {
      mockUserModel.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      const user = { id: 'uuid-1', email: 'john@test.com' };
      mockUserModel.findOne.mockResolvedValue(user);

      expect(await service.findByEmail('john@test.com')).toEqual(user);
    });
  });

  describe('findByUsernameOrEmail', () => {
    it('should return user by username or email', async () => {
      const user = {
        id: 'uuid-1',
        userName: 'johndoe',
        email: 'john@test.com',
      };
      mockUserModel.findOne.mockResolvedValue(user);

      expect(await service.findByUsernameOrEmail('johndoe')).toEqual(user);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const user = { id: 'uuid-1' };
      mockUserModel.findByPk.mockResolvedValue(user);

      expect(await service.findById('uuid-1')).toEqual(user);
    });
  });

  describe('preferences', () => {
    it('should return the stored notifyBookings flag', async () => {
      mockUserModel.findByPk.mockResolvedValue({ notifyBookings: false });

      expect(await service.getPreferences('uuid-1')).toEqual({
        notifyBookings: false,
      });
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserModel.findByPk.mockResolvedValue(null);

      await expect(service.getPreferences('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should persist notifyBookings and return the new value', async () => {
      const user = {
        notifyBookings: true,
        update: jest.fn().mockImplementation(function (this: void, values: any) {
          user.notifyBookings = values.notifyBookings;
        }),
      };
      mockUserModel.findByPk.mockResolvedValue(user);

      const result = await service.updatePreferences('uuid-1', {
        notifyBookings: false,
      });

      expect(user.update).toHaveBeenCalledWith({ notifyBookings: false });
      expect(result).toEqual({ notifyBookings: false });
    });

    // `false` es un valor válido: la guarda mira `undefined`, no falsy.
    it('should accept turning notifications off', async () => {
      const user = { notifyBookings: true, update: jest.fn() };
      mockUserModel.findByPk.mockResolvedValue(user);

      await service.updatePreferences('uuid-1', { notifyBookings: false });

      expect(user.update).toHaveBeenCalledWith({ notifyBookings: false });
    });

    it('should throw BadRequestException when no preference is sent', async () => {
      await expect(service.updatePreferences('uuid-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validatePassword', () => {
    it('should delegate to bcrypt.compare', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      expect(await service.validatePassword('plain', 'hashed')).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
    });
  });
});
