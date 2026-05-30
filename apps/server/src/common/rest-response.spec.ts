// RestResponse 단위 테스트.
//
// 학습 포인트:
// - Builder pattern (fluent interface) — `.success(data)`, `.error(msg)`가 this 반환.
// - 기본값 검증: type=SUCCESS, code=NORMAL, status=OK, method=NONE, data/message=null.
// - error 호출 시 status가 OK면 500으로 자동 변경 (사용자가 명시 안 했을 때 안전 default).
// - build(): controller 반환 / interceptor wrap 시 사용하는 직렬화 형태.

import { HttpStatus } from '@nestjs/common';

import {
  RestResponse,
  RestResponseCode,
  RestResponseMethod,
  RestResponseType,
} from './rest-response';

describe('RestResponse', () => {
  describe('기본값', () => {
    it('생성 직후엔 SUCCESS / NORMAL / 200 / NONE을 기본값으로 가진다', () => {
      const res = new RestResponse();

      expect(res.type).toBe(RestResponseType.SUCCESS);
      expect(res.code).toBe(RestResponseCode.NORMAL);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.method).toBe(RestResponseMethod.NONE);
      expect(res.data).toBeNull();
      expect(res.message).toBeNull();
    });
  });

  describe('success', () => {
    it('data를 박제하면 type/data를 SUCCESS와 함께 박는다', () => {
      const res = new RestResponse<{ id: string }>().success({ id: 'uuid-1' });

      expect(res.type).toBe(RestResponseType.SUCCESS);
      expect(res.data).toEqual({ id: 'uuid-1' });
    });

    it('option으로 message/code/status/method를 함께 설정할 수 있다', () => {
      const res = new RestResponse<{ id: string }>().success(
        { id: 'uuid-1' },
        {
          message: '저장되었습니다',
          code: '050',
          status: HttpStatus.CREATED,
          method: RestResponseMethod.LOG_OUT,
        },
      );

      expect(res.message).toBe('저장되었습니다');
      expect(res.code).toBe('050');
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.method).toBe(RestResponseMethod.LOG_OUT);
    });

    it('option 없이 호출하면 기본값을 유지한다 (data만 박힘)', () => {
      const res = new RestResponse<{ id: string }>().success({ id: 'uuid-1' });

      expect(res.message).toBeNull();
      expect(res.code).toBe(RestResponseCode.NORMAL);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.method).toBe(RestResponseMethod.NONE);
    });

    it('this를 반환해서 chain이 가능하다', () => {
      const res = new RestResponse<string>()
        .success('payload')
        .setStatus(HttpStatus.ACCEPTED)
        .setMethod(RestResponseMethod.LOG_OUT);

      expect(res.data).toBe('payload');
      expect(res.status).toBe(HttpStatus.ACCEPTED);
      expect(res.method).toBe(RestResponseMethod.LOG_OUT);
    });
  });

  describe('error', () => {
    it('message만 주면 ERROR 타입 + 기본 INTERNAL_SERVER_ERROR로 박힌다', () => {
      const res = new RestResponse().error('서버 에러');

      expect(res.type).toBe(RestResponseType.ERROR);
      expect(res.message).toBe('서버 에러');
      expect(res.code).toBe(RestResponseCode.INTERNAL_SERVER_ERROR);
      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('option으로 code/status/method/data를 함께 설정할 수 있다', () => {
      const res = new RestResponse<null>().error('이메일 중복', {
        code: RestResponseCode.DUPLICATE_ERROR,
        status: HttpStatus.CONFLICT,
        method: RestResponseMethod.NONE,
        data: null,
      });

      expect(res.message).toBe('이메일 중복');
      expect(res.code).toBe(RestResponseCode.DUPLICATE_ERROR);
      expect(res.status).toBe(HttpStatus.CONFLICT);
    });

    it('status가 명시되지 않으면 기본 500 (OK는 에러 의미와 모순이라 자동 변환)', () => {
      const res = new RestResponse().error('알 수 없는 에러');

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('refresh 만료 시나리오 — LOG_OUT method를 박을 수 있다', () => {
      const res = new RestResponse().error('유효하지 않은 refresh token', {
        code: RestResponseCode.TOKEN_EXPIRED,
        status: HttpStatus.UNAUTHORIZED,
        method: RestResponseMethod.LOG_OUT,
      });

      expect(res.code).toBe(RestResponseCode.TOKEN_EXPIRED);
      expect(res.method).toBe(RestResponseMethod.LOG_OUT);
    });
  });

  describe('setStatus / setMethod', () => {
    it('setStatus는 status만 변경하고 다른 필드는 유지한다', () => {
      const res = new RestResponse<string>().success('data').setStatus(HttpStatus.ACCEPTED);

      expect(res.status).toBe(HttpStatus.ACCEPTED);
      expect(res.type).toBe(RestResponseType.SUCCESS);
      expect(res.data).toBe('data');
    });

    it('setMethod는 method만 변경한다', () => {
      const res = new RestResponse<string>().success('data').setMethod(RestResponseMethod.BLOCKED);

      expect(res.method).toBe(RestResponseMethod.BLOCKED);
      expect(res.data).toBe('data');
    });
  });

  describe('build', () => {
    it('현재 상태를 plain object로 직렬화한다 (controller 반환용)', () => {
      const res = new RestResponse<{ id: number }>().success(
        { id: 1 },
        { message: 'ok', method: RestResponseMethod.NONE },
      );

      expect(res.build()).toEqual({
        type: RestResponseType.SUCCESS,
        code: RestResponseCode.NORMAL,
        data: { id: 1 },
        message: 'ok',
        status: HttpStatus.OK,
        method: RestResponseMethod.NONE,
      });
    });
  });
});
