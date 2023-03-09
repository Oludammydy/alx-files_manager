import { expect, use, should, request } from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { ObjectId } from 'mongodb';
import { exec } from 'child_process';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

// File Endpoints ==============================================

describe('testing File Endpoints', () => {
  const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
  let token = '';
  let userId = '';
  let fileId = '';
  let parentId = '';

  const user = {
    email: 'bob@dylan.com',
    password: 'toto1234!',
  };

  before(async () => {
    await redisClient.client.flushall('ASYNC');
    await dbClient.usersCollection.deleteMany({});
    await dbClient.filesCollection.deleteMany({});

    let response, body;

    response = await request(app).post('/users').send(user);
    body = JSON.parse(response.text);

    userId = body.id;

    response = await request(app)
      .get('/connect')
      .set('Authorization', credentials)
      .send();
    body = JSON.parse(response.text);

    token = body.token;
  });

  after(async () => {
    await redisClient.client.flushall('ASYNC');
    await dbClient.usersCollection.deleteMany({});
    await dbClient.filesCollection.deleteMany({});
    // Remove folder where files were created locally
    exec('rm -rf /tmp/files_manager', (error, stdout, stderr) => {
      if (error) {
        return;
      }
      if (stderr) {
        return;
      }
    });
  });

  describe('POST /files', () => {
    it('returns error because missing user Token', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app).post('/files').send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    it('returns error because of Missing name', async () => {
      const fileInfo = {
        // name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Missing name' });
      expect(response.statusCode).to.equal(400);
    });

    it('returns error because of Missing type', async () => {
      const fileInfo = {
        name: 'myText.txt',
        //   type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Missing type' });
      expect(response.statusCode).to.equal(400);
    });

    it('returns error because of Wrong type', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'video',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Missing type' });
      expect(response.statusCode).to.equal(400);
    });

    it('returns error because of Missing data and not being folder', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        // data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Missing data' });
      expect(response.statusCode).to.equal(400);
    });

    it('returns the created file without passing isPublic or parentId', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(false);
      expect(body.parentId).to.equal(0);
      expect(body).to.have.property('id');

      expect(response.statusCode).to.equal(201);

      fileId = body.id;
      const fileMongo = await dbClient.filesCollection.findOne({
        _id: ObjectId(body.id),
      });
      expect(fileMongo).to.exist;
      expect(fileMongo.localPath).to.exist;
    });

    it('returns the created file passing isPublic true', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: true,
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(true);
      expect(body.parentId).to.equal(0);
      expect(body).to.have.property('id');

      expect(response.statusCode).to.equal(201);

      const fileMongo = await dbClient.filesCollection.findOne({
        _id: ObjectId(body.id),
      });
      expect(fileMongo).to.exist;
      expect(fileMongo.localPath).to.exist;
    });

    it('returns the created Folder', async () => {
      const fileInfo = {
        name: 'images',
        type: 'folder',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(false);
      expect(body.parentId).to.equal(0);
      expect(body).to.have.property('id');

      expect(response.statusCode).to.equal(201);

      parentId = body.id;
      const folderMongo = await dbClient.filesCollection.findOne({
        _id: ObjectId(body.id),
      });
      expect(folderMongo).to.exist;
      expect(folderMongo.localPath).to.not.exist;
    });

    it('returns error because of non existent parentId', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        parentId: '5f1e7cda04a394508232559d',
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Parent not found' });
      expect(response.statusCode).to.equal(400);
    });

    it('returns error because of parentId is not from a folder', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        parentId: fileId,
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Parent is not a folder' });
      expect(response.statusCode).to.equal(400);
    });

    it('returns the created file with tied parentId', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        parentId,
      };

      const response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      const body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(false);
      expect(body.parentId).to.equal(parentId);
      expect(body).to.have.property('id');

      expect(response.statusCode).to.equal(201);

      fileId = body.id;
      const fileMongo = await dbClient.filesCollection.findOne({
        _id: ObjectId(body.id),
      });
      expect(fileMongo).to.exist;
    });
  });

  describe('GET /files/:id', () => {
    it('return error unauthorized because of non existent user', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .get(`/files/${fileId}`)
        .set('Token-X', 123)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Unauthorized' });

      expect(response.statusCode).to.equal(401);
    });

    it('return the file document based on the ID', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .get(`/files/${fileId}`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);
      expect(body.id).to.equal(fileId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(false);
      expect(body.parentId).to.equal(parentId);
      expect(response.statusCode).to.equal(200);
    });

    it('return error not found because file not associated to id', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
      };

      const response = await request(app)
        .get(`/files/${userId}`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Not found' });
      expect(response.statusCode).to.equal(404);
    });
  });

  describe('GET /files', () => {
    before(async () => {
      await dbClient.filesCollection.deleteMany({});
    });

    it('return error unauthorized because of non existent user', async () => {
      const response = await request(app)
        .get(`/files`)
        .set('X-Token', 123)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Unauthorized' });

      expect(response.statusCode).to.equal(401);
    });

    it('return empty list because parentId does not exist', async () => {
      const response = await request(app)
        .get(`/files?parentId=5f1e881cc7ba06511e683b23`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql([]);
      expect(response.statusCode).to.equal(200);
    });

    it('return 20 files of root first page', async () => {
      for (let index = 0; index < 35; index++) {
        await dbClient.filesCollection.insertOne({
          name: 'myText.txt',
          type: 'file',
          data: 'SGVsbG8gV2Vic3RhY2shCg==',
          isPublic: false,
          userId,
          parentId: 0,
        });
      }
      const response = await request(app)
        .get(`/files`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body.length).to.equal(20);
      expect(response.statusCode).to.equal(200);
    });

    it('return 15 files of root second page', async () => {
      const response = await request(app)
        .get(`/files?page=1`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body.length).to.equal(15);
      expect(response.statusCode).to.equal(200);
    });

    it('return 0 files of root third page', async () => {
      const response = await request(app)
        .get(`/files?page=2`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body.length).to.equal(0);
      expect(response.statusCode).to.equal(200);

      await dbClient.filesCollection.deleteMany({});
    });

    it('return 20 files of root first page with parentId', async () => {
      await dbClient.filesCollection.insertOne({
        _id: ObjectId(parentId),
        name: 'text_files',
        type: 'folder',
        parentId: 0,
      });

      for (let index = 0; index < 35; index++) {
        await dbClient.filesCollection.insertOne({
          name: 'myText.txt',
          type: 'file',
          data: 'SGVsbG8gV2Vic3RhY2shCg==',
          isPublic: false,
          userId,
          parentId: ObjectId(parentId),
        });
      }
      const obj = await dbClient.filesCollection.findOne({
        _id: Object(parentId),
      });

      const response = await request(app)
        .get(`/files?parentId=${parentId}`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body.length).to.equal(20);
      expect(response.statusCode).to.equal(200);

      await dbClient.filesCollection.deleteMany({});
    });
  });

  describe('PUT /files/:id/publish', () => {
    it('returns Error Unauthorized because user does not exist', async () => {
      const response = await request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', 123)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    it('returns Not Found because no file linked to user found', async () => {
      fileId = 'xA41x8w4fq3g';
      const response = await request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Not found' });
      expect(response.statusCode).to.equal(404);
    });

    it('returns file with isPublic attributed changed to true', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: false,
      };

      let response;
      let body;

      response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(false);

      fileId = body.id;

      response = await request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', token)
        .send();

      body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(true);
      expect(response.statusCode).to.equal(200);

      await dbClient.filesCollection.deleteMany({});
    });
  });
  describe('PUT /files/:id/unpublish', () => {
    it('returns Error Unauthorized because user does not exist', async () => {
      const response = await request(app)
        .put(`/files/${fileId}/unpublish`)
        .set('X-Token', 123)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Unauthorized' });
      expect(response.statusCode).to.equal(401);
    });

    it('returns Not Found because no file linked to user found', async () => {
      fileId = 'xA41x8w4fq3g';
      const response = await request(app)
        .put(`/files/${fileId}/unpublish`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Not found' });
      expect(response.statusCode).to.equal(404);
    });

    it('returns file with isPublic attributed changed to true', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: true,
      };

      let response;
      let body;

      response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(true);

      fileId = body.id;

      response = await request(app)
        .put(`/files/${fileId}/unpublish`)
        .set('X-Token', token)
        .send();

      body = JSON.parse(response.text);

      expect(body.userId).to.equal(userId);
      expect(body.name).to.equal(fileInfo.name);
      expect(body.type).to.equal(fileInfo.type);
      expect(body.isPublic).to.equal(false);
      expect(response.statusCode).to.equal(200);

      await dbClient.filesCollection.deleteMany({});
    });
  });
  describe('GET /files/:id/data', () => {
    it('returns Error Not Found because file is not linked to ID', async () => {
      fileId = 'ASxWCefcv654';
      const response = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Not found' });
      expect(response.statusCode).to.equal(404);
    });

    it('returns Error Not Found because file is not locally available', async () => {
      const file = await dbClient.filesCollection.insertOne({
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: false,
        userId,
        parentId: 0,
      });

      fileId = file.insertedId.toString();
      const response = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token)
        .send();

      const body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Not found' });
      expect(response.statusCode).to.equal(404);
    });

    it('returns error with folder because it has no data', async () => {
      const fileInfo = {
        name: 'images',
        type: 'folder',
      };

      let body;
      let response;

      response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      body = JSON.parse(response.text);
      fileId = body.id;

      response = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token)
        .send();

      body = JSON.parse(response.text);

      expect(body).to.eql({ error: "A folder doesn't have content" });
      expect(response.statusCode).to.equal(400);
    });

    it('returns file data because it is not public but and user is not owner', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: false,
      };

      let body;
      let response;

      response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      body = JSON.parse(response.text);
      fileId = body.id;

      response = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', 'asdwwx89716')
        .send();

      body = JSON.parse(response.text);

      expect(body).to.eql({ error: 'Not found' });
      expect(response.statusCode).to.equal(404);
    });

    it('returns file data because it is not public but user is owner', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: false,
      };

      let body;
      let response;

      response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      body = JSON.parse(response.text);
      fileId = body.id;

      response = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token)
        .send();
      expect(response.header['content-type']).to.be.equal(
        'text/plain; charset=utf-8'
      );
      expect(response.text).to.equal('Hello Webstack!\n');
      expect(response.statusCode).to.equal(200);
    });

    it('returns file data because it is public', async () => {
      const fileInfo = {
        name: 'myText.txt',
        type: 'file',
        data: 'SGVsbG8gV2Vic3RhY2shCg==',
        isPublic: true,
      };

      let body;
      let response;

      response = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send(fileInfo);

      body = JSON.parse(response.text);
      fileId = body.id;

      response = await request(app).get(`/files/${fileId}/data`).send();

      expect(response.header['content-type']).to.be.equal(
        'text/plain; charset=utf-8'
      );
      expect(response.text).to.equal('Hello Webstack!\n');
      expect(response.statusCode).to.equal(200);
    });
  });
});
