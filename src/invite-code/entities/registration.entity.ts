import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  walletAddress: string;

  @Column()
  inviteCode: string;

  @Column()
  signature: string;

  @CreateDateColumn()
  createdAt: Date;
}