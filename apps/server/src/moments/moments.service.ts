// MomentsService — Moment 도메인 비즈니스 로직.
//
// 책임:
// - create(userId, dto): 본인 moment 생성
// - findByUserId(userId): 본인 moment 리스트 (createdAt DESC)
//
// 학습 포인트:
// - 응답은 RestResponse<T> 표준화 (AuthService 패턴 일관). 단순 CRUD라도 wrapping.
// - 도메인 객체 → ResponseDto 변환은 private mapper로 분리 (재사용 + 직렬화 한 곳).
// - findByUserId는 본인 것만 — service 단계에서 userId 필터로 가드 (controller가 @CurrentUser 박음).

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RestResponse } from '../common';

import { CreateMomentRequestDto, CreateMomentResponseDto } from './dtos/create-moment.dto';
import { GetMomentsResponseDto, MomentListItemDto } from './dtos/get-moments.dto';
import { Moment } from './moment.entity';

@Injectable()
export class MomentsService {
  constructor(
    @InjectRepository(Moment)
    private readonly momentRepo: Repository<Moment>,
  ) {}

  /** 본인 moment 생성. ON DELETE CASCADE는 entity에서 박혀있어 service에선 신경 X. */
  async createMoment(
    userId: string,
    dto: CreateMomentRequestDto,
  ): Promise<RestResponse<CreateMomentResponseDto>> {
    const entity = this.momentRepo.create({
      userId,
      title: dto.title,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
      endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
    });
    const saved = await this.momentRepo.save(entity);

    return new RestResponse<CreateMomentResponseDto>().success(this.toResponseDto(saved), {
      status: HttpStatus.CREATED,
    });
  }

  /** 본인 moment 리스트 (createdAt DESC). Phase 후속 페이지네이션 도입 검토. */
  async findMomentsByUserId(userId: string): Promise<RestResponse<GetMomentsResponseDto>> {
    const moments = await this.momentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return new RestResponse<GetMomentsResponseDto>().success({
      moments: moments.map((moment) => this.toListItemDto(moment)),
    });
  }

  /**
   * 본인 userId의 moment 1건 조회 (권한 검증용).
   * 다른 도메인(Photos 등)에서 momentId 권한 확인 시 호출.
   * 본인 것이 아니면 null → 호출자가 NOT_FOUND 또는 FORBIDDEN 응답.
   */
  async findMomentByIdAndUserId(id: string, userId: string): Promise<Moment | null> {
    return this.momentRepo.findOne({ where: { id, userId } });
  }

  /** Moment entity → CreateMomentResponseDto. Date → ISO string 변환. */
  private toResponseDto(moment: Moment): CreateMomentResponseDto {
    return {
      id: moment.id,
      title: moment.title,
      startedAt: moment.startedAt?.toISOString() ?? null,
      endedAt: moment.endedAt?.toISOString() ?? null,
      createdAt: moment.createdAt.toISOString(),
      updatedAt: moment.updatedAt.toISOString(),
    };
  }

  /** Moment entity → MomentListItemDto. Shape 동일하지만 명시 분리 (룰: Request/Response 명시). */
  private toListItemDto(moment: Moment): MomentListItemDto {
    return this.toResponseDto(moment);
  }
}
