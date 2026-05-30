// UsersService — User 엔티티의 DB 조작 책임.
//
// Data Mapper 패턴 (NestJS 정석): Repository를 주입받아 사용.
// AuthService가 이 service를 주입받아 sign-up/sign-in 흐름에서 사용.
//
// 학습 포인트:
// - @InjectRepository(User): TypeOrmModule.forFeature([User])가 DI에 등록한 Repository를 주입
// - findUserByEmailWithPassword: password도 함께 가져옴 (entity는 select: false라 기본 조회에서 제외됨 → 명시적으로)
// - create vs save: create는 entity 인스턴스 생성만, save가 INSERT 실행
// - 메서드명에 도메인 명사(`User`) 명시 — 룰 `nest-backend.md` 메서드 명명 섹션 참고

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** 이메일로 user 조회 — 인증 시 password 비교 위해 password 컬럼 명시적 select. */
  async findUserByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password') // entity의 select: false 우회
      .where('user.email = :email', { email })
      .getOne();
  }

  /** 이메일로 user 조회 — 일반 조회 (password 제외). */
  async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  /** id로 user 조회 — JWT payload의 sub claim으로부터 사용. */
  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  /**
   * 새 user 생성. 이미 해시된 password 받음 (AuthService가 bcrypt 처리).
   * 이메일 중복은 unique 제약으로 DB가 거절 — AuthService가 캐치해서 적절한 에러로.
   */
  async createUser(params: { email: string; passwordHash: string }): Promise<User> {
    const user = this.userRepo.create({
      email: params.email,
      password: params.passwordHash,
    });
    return this.userRepo.save(user);
  }
}
