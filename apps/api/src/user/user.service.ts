import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({ email: dto.email, passwordHash });
    return this.userRepo.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOneBy({ id });
  }

  async updateRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.userRepo.update(userId, { refreshTokenHash: hash });
  }

  async createAdmin(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ email, passwordHash, role: 'admin', status: 'approved' });
    return this.userRepo.save(user);
  }

  findAdmin(): Promise<User | null> {
    return this.userRepo.findOneBy({ role: 'admin' });
  }

  findAllNonAdmin(): Promise<Pick<User, 'id' | 'email' | 'status' | 'createdAt'>[]> {
    return this.userRepo.find({
      where: { role: Not('admin' as const) },
      select: ['id', 'email', 'status', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(userId: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
    await this.userRepo.update(userId, { status });
  }
}
