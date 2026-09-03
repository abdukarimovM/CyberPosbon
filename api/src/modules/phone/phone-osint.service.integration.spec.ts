const { PhoneOsintService } = require('./phone-osint.service');

describe('PhoneOsintService integration', () => {
    it('should detect a known scam phone via ktozvonil direct lookup', async () => {
        const service = new PhoneOsintService();
        const phone = '+380960012447';

        const result = await service.searchFraudTraces(phone);

        console.log('OSINT_INTEGRATION_RESULT', JSON.stringify({
            found: result.found,
            matchesCount: result.matchesCount,
            snippets: result.snippets,
            sources: result.sources,
        }, null, 2));

        expect(result.found).toBe(true);
        expect(result.matchesCount).toBe(1);
        expect(result.sources).toContain('https://ktozvonil.net/nomer/380960012447');
    }, 30000);
});
