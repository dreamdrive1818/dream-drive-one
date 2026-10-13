import { readableError } from '../../../lib/http-error.filter';

describe('readableError', () => {
  it('uses the exception message instead of the generic status text', () => {
    expect(
      readableError(
        { statusCode: 400, message: 'Date of birth is required', error: 'Bad Request' },
        'Bad Request'
      )
    ).toBe('Date of birth is required');
  });

  it('joins validation message arrays', () => {
    expect(readableError({ message: ['email must be set', 'phone too short'] }, 'Bad Request')).toBe(
      'email must be set; phone too short'
    );
  });

  it('falls back to a custom error field, then the exception message', () => {
    expect(readableError({ error: 'Too many OTP requests' }, 'x')).toBe('Too many OTP requests');
    expect(readableError({}, 'Not Found')).toBe('Not Found');
  });
});
