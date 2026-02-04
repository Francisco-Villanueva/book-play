import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  const mockUsersService = {
    create: jest.fn(),
    findByUsernameOrEmail: jest.fn(),
    validatePassword: jest.fn(),
  };
  const mockJwtService = { sign: jest.fn().mockReturnValue('jwt-token') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('jwt-token');
  });

  const mockUser = {
    id: 'uuid-1',
    email: 'john@test.com',
    name: 'John',
    password: 'hashed',
    toJSON: () => ({ id: 'uuid-1', email: 'john@test.com', name: 'John' }),
  };

  describe('register', () => {
    it('should create user and return auth response', async () => {
      mockUsersService.create.mockResolvedValue(mockUser);
      const dto = {
        name: 'John',
        email: 'john@test.com',
        password: 'password123',
        userName: 'johndoe',
      };

      const result = await service.register(dto as any);

      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe('john@test.com');
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials valid', async () => {
      mockUsersService.findByUsernameOrEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);

      const result = await service.validateUser('johndoe', 'password123');
      expect(result).toBe(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUsersService.findByUsernameOrEmail.mockResolvedValue(null);

      expect(await service.validateUser('no@test.com', 'pass')).toBeNull();
    });

    it('should return null when password invalid', async () => {
      mockUsersService.findByUsernameOrEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      expect(await service.validateUser('johndoe', 'wrong')).toBeNull();
    });
  });

  describe('login', () => {
    it('should return auth response when credentials valid', async () => {
      mockUsersService.findByUsernameOrEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);

      const result = await service.login({ username: 'johndoe', password: 'password123' });

      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.email).toBe('john@test.com');
    });

    it('should throw UnauthorizedException when credentials invalid', async () => {
      mockUsersService.findByUsernameOrEmail.mockResolvedValue(null);

      await expect(
        service.login({ username: 'invalid', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
