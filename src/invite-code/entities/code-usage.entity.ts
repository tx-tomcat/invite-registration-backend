import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InviteCode } from './invite-code.entity';

@Entity()
export class CodeUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userEmail: string;

  @Column()
  inviteCodeId: string;

  @ManyToOne(() => InviteCode)
  @JoinColumn()
  inviteCode: InviteCode;

  @Column()
  ipAddress: string;

  @Column({ type: 'jsonb', nullable: true })
  deviceInfo: Record<string, any>;

  @CreateDateColumn()
  usedAt: Date;
}
