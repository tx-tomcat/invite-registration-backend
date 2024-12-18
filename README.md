# NFT-Gated Invite Code System

A NestJS application implementing a secure invite code system with NFT ownership verification, email validation, and wallet integration.

## Setup Instructions

1. **Install Dependencies**

```bash
pnpm install
```

2. **Configure Environment**

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=invite_system

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting
RATE_LIMIT_POINTS=5
RATE_LIMIT_DURATION=60
PORT=3001
```

## Design Decisions

### 1. Performance Optimization

- **Redis Caching Strategy**:

  - Cache invite code verification results
  - Cache email and wallet usage status
  - TTL-based cache invalidation
  - Reason: Reduce database load and improve response times

- **Rate Limiting**:
  - Redis-based rate limiter
  - Configurable attempts and duration
  - Reason: Prevent abuse and ensure system stability

### 2. Data Consistency

- **Pessimistic Locking**:

```typescript
await manager.findOne(InviteCode, {
  where: { code },
  lock: { mode: 'pessimistic_write' },
});
```

- Reason: Prevent race conditions during concurrent registrations

- **Transaction Management**:
  ```typescript
  await this.dataSource.transaction(async (manager) => {
    // Atomic operations
  });
  ```
  - Reason: Ensure data integrity across multiple operations

### 3. Security Measures

- **Signature Verification**:

  ```typescript
  const signerAddress = ethers.verifyMessage(message, signature);
  ```

  - Reason: Ensure wallet ownership

- **Input Validation**:

  ```typescript
  @IsEmail()
  email: string;

  @IsEthereumAddress()
  walletAddress: string;
  ```

  - Reason: Prevent invalid data and potential attacks

### 4. Cache Architecture

```typescript
// Multiple cache layers
const CACHE_KEYS = {
  EMAIL: 'email:',
  WALLET: 'wallet:',
  INVITE: 'invite:',
};
```

- Reason: Organize different types of cached data

## Testing Strategy

### 1. Unit Tests

```typescript
describe('InviteCodeService', () => {
  describe('verifyInviteCode', () => {
    it('should return true for valid code');
    it('should return false for invalid code');
    it('should handle expired codes');
  });
});
```

### 2. Integration Tests

```typescript
describe('Registration Flow', () => {
  it('should handle complete registration process');
  it('should prevent duplicate registrations');
  it('should handle concurrent requests');
});
```

### 3. Load Testing

- Used Artillery for performance testing
- Tested concurrent user scenarios
- Verified rate limiting effectiveness
- Monitored cache hit rates

## Future Improvements

### 1. Enhanced Security

- Implement JWT authentication
- Add request signing
- Enhanced rate limiting algorithms
- IP-based restrictions

### 2. Better Scalability

```typescript
// Implement queue system
@Injectable()
export class QueueService {
  async addToQueue(registration: RegistrationDto) {
    // Process registrations in order
  }
}
```

### 3. Monitoring & Logging

- Add Prometheus metrics
- Implement structured logging
- Add performance monitoring
- Track cache statistics

### 4. Feature Additions

- Admin dashboard
- Batch operations support
- Email verification system
- Analytics dashboard
- Webhook notifications

### 5. Testing Improvements

- Add E2E tests
- Implement stress testing
- Add security testing
- Improve test coverage

### 6. Cache Optimization

- Implement cache warming
- Add cache preloading
- Optimize cache patterns
- Implement cache analytics

## Known Limitations

1. **Current Implementation**

- Basic rate limiting
- Simple caching strategy
- Limited admin features
- Basic error responses

2. **Missing Features**

- No automated cleanup
- Limited monitoring
- Basic analytics
- No backup strategy

3. **Technical Debt**

- Need better error handling
- Limited test coverage
- Basic logging
- Simple cache invalidation

## Usage Examples

### Verify Invite Code

```typescript
const isValid = await inviteService.verifyInviteCode('ABC123');
```

### Register User

```typescript
await inviteService.reserveInvite({
  code: 'ABC123',
  email: 'user@example.com',
  walletAddress: '0x...',
  signature: '0x...',
});
```

## Environment Requirements

- Node.js 16+
- PostgreSQL 13+
- Redis 6+
- TypeScript 4.5+

## Monitoring Recommendations

1. **Key Metrics**

- Cache hit rates
- Registration success rates
- API response times
- Error rates

2. **Alerts**

- High error rates
- Cache miss spikes
- Database connection issues
- Rate limit breaches

## Additional Notes

- Documentation needs improvement
- Consider adding API versioning
- Need better deployment docs
- Consider containerization
