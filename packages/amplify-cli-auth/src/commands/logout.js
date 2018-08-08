import { auth } from '@axway/amplify-cli-utils';

export default {
	args: [
		{
			name: 'accounts...',
			desc: 'one or more specific accounts to revoke credentials'
		}
	],
	desc: 'log out of the AMPLIFY platform',
	async action({ argv, console }) {
		try {
			await auth.logout({
				baseUrl:  argv.baseUrl,
				clientId: argv.clientId,
				env:      argv.env,
				realm:    argv.realm
			});
			console.log('Logged out successfully');
		} catch (e) {
			console.error(`Logout failed: ${e.message}`);
		}
	}
};
