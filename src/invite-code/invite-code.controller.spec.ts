import { Test, TestingModule } from '@nestjs/testing';
import { InviteCodeController } from './invite-code.controller';
import { InviteCodeService } from './invite-code.service';

describe('InviteCodeController', () => {
  let controller: InviteCodeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InviteCodeController],
      providers: [InviteCodeService],
    }).compile();

    controller = module.get<InviteCodeController>(InviteCodeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
