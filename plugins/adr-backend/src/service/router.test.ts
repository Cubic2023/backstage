/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ReadTreeResponse,
  ReadTreeResponseFile,
  ReadUrlResponse,
  SearchResponse,
  UrlReader,
} from '@backstage/backend-common';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';

const makeBufferFromString = (string: string) => async () =>
  Buffer.from(string);

const testingUrlFakeFileTree: ReadTreeResponseFile[] = [
  {
    path: 'folder/testFile001.txt',
    content: makeBufferFromString('folder/testFile001.txt content'),
  },
  {
    path: 'testFile001.txt',
    content: makeBufferFromString('testFile002.txt content'),
  },
  {
    path: 'testFile002.txt',
    content: makeBufferFromString('testFile001.txt content'),
  },
];

const makeFileContent = async (fileContent: string) => {
  const result: ReadUrlResponse = {
    buffer: makeBufferFromString(fileContent),
  };
  return result;
};

const testFileOneContent = 'testFileOne content';
const testFileTwoContent = 'testFileTwo content';
const genericFileContent = 'file content';

const mockUrlReader: UrlReader = {
  read() {
    throw new Error('read not implemented.');
  },
  readUrl(url: string) {
    switch (url) {
      case 'testFileOne':
        return makeFileContent(testFileOneContent);
      case 'testFileTwo':
        return makeFileContent(testFileTwoContent);
      default:
        return makeFileContent(genericFileContent);
    }
  },
  readTree() {
    const result: ReadTreeResponse = {
      files: async () => testingUrlFakeFileTree,
      archive() {
        throw new Error('Function not implemented.');
      },
      dir() {
        throw new Error('Function not implemented.');
      },
      etag: '',
    };

    const resultPromise = async () => result;
    return resultPromise();
  },
  search() {
    throw new Error('search not implemented.');
  },
};

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    jest.resetAllMocks();

    const router = await createRouter(mockUrlReader);
    app = express().use(router);
  });

  describe('GET /getAdrFilesAtUrl', () => {
    it('returns bad request (400) when no url is provided', async () => {
      const urlNotSpecifiedRequest = await request(app).get(
        '/getAdrFilesAtUrl',
      );
      const urlNotSpecifiedStatus = urlNotSpecifiedRequest.status;
      const urlNotSpecifiedMessage = urlNotSpecifiedRequest.body.message;

      const urlNotFilledRequest = await request(app).get(
        '/getAdrFilesAtUrl?url=',
      );
      const urlNotFilledStatus = urlNotFilledRequest.status;
      const urlNotFilledMessage = urlNotFilledRequest.body.message;

      const expectedStatusCode = 400;
      const expectedErrorMessage = 'No URL provided';

      expect(urlNotSpecifiedStatus).toBe(expectedStatusCode);
      expect(urlNotSpecifiedMessage).toBe(expectedErrorMessage);

      expect(urlNotFilledStatus).toBe(expectedStatusCode);
      expect(urlNotFilledMessage).toBe(expectedErrorMessage);
    });

    it('returns the correct listing when reading a url', async () => {
      const result = await request(app).get('/getAdrFilesAtUrl?url=testing');
      const { status, body, error } = result;

      const expectedStatusCode = 200;
      const expectedBody = {
        data: [
          {
            type: 'file',
            name: 'testFile001.txt',
            path: 'folder/testFile001.txt',
          },
          {
            type: 'file',
            name: 'testFile001.txt',
            path: 'testFile001.txt',
          },
          {
            type: 'file',
            name: 'testFile002.txt',
            path: 'testFile002.txt',
          },
        ],
      };

      expect(error).toBeFalsy();
      expect(status).toBe(expectedStatusCode);
      expect(body).toEqual(expectedBody);
    });
  });

  describe('GET /readAdrFileAtUrl', () => {
    it('returns bad request (400) when no url is provided', async () => {
      const urlNotSpecifiedRequest = await request(app).get(
        '/readAdrFileAtUrl',
      );
      const urlNotSpecifiedStatus = urlNotSpecifiedRequest.status;
      const urlNotSpecifiedMessage = urlNotSpecifiedRequest.body.message;

      const urlNotFilledRequest = await request(app).get(
        '/readAdrFileAtUrl?url=',
      );
      const urlNotFilledStatus = urlNotFilledRequest.status;
      const urlNotFilledMessage = urlNotFilledRequest.body.message;

      const expectedStatusCode = 400;
      const expectedErrorMessage = 'No URL provided';

      expect(urlNotSpecifiedStatus).toBe(expectedStatusCode);
      expect(urlNotSpecifiedMessage).toBe(expectedErrorMessage);

      expect(urlNotFilledStatus).toBe(expectedStatusCode);
      expect(urlNotFilledMessage).toBe(expectedErrorMessage);
    });

    it('returns the correct file contents when reading a url', async () => {
      const fileOneResponse = await request(app).get(
        '/readAdrFileAtUrl?url=testFileOne',
      );
      const fileOneStatus = fileOneResponse.status;
      const fileOneBody = fileOneResponse.body;
      const fileOneError = fileOneResponse.error;

      const fileTwoResponse = await request(app).get(
        '/readAdrFileAtUrl?url=testFileTwo',
      );
      const fileTwoStatus = fileTwoResponse.status;
      const fileTwoBody = fileTwoResponse.body;
      const fileTwoError = fileTwoResponse.error;

      const expectedStatusCode = 200;

      expect(fileOneError).toBeFalsy();
      expect(fileOneStatus).toBe(expectedStatusCode);
      expect(fileOneBody.data).toBe(testFileOneContent);

      expect(fileTwoError).toBeFalsy();
      expect(fileTwoStatus).toBe(expectedStatusCode);
      expect(fileTwoBody.data).toBe(testFileTwoContent);
    });
  });
});
