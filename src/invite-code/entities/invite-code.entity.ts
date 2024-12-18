import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { CodeUsage } from './code-usage.entity';

@Entity()
export class InviteCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  code: string;

  @Column()
  creatorEmail: string;

  @Column()
  maxUses: number;

  @Column({ default: 0 })
  currentUses: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CodeUsage, (usage) => usage.inviteCode)
  usages: CodeUsage[];
}
