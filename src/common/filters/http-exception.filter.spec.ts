import { ArgumentsHost, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ method: 'GET', url: '/some/path' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats a built-in HttpException subclass into { statusCode, message, error }', () => {
    filter.catch(new NotFoundException('Post not found'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Post not found',
      error: 'Not Found',
    });
  });

  it('handles a plain HttpException constructed with a string response', () => {
    filter.catch(new HttpException('Custom message', HttpStatus.BAD_REQUEST), host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Custom message',
      error: 'HttpException',
    });
  });

  it('falls back to a generic 500 for a non-HttpException error, without leaking its details', () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('a raw database connection error'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(loggerSpy).toHaveBeenCalled();

    loggerSpy.mockRestore();
  });
});
