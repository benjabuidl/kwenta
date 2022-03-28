import { useQuery, UseQueryOptions } from 'react-query';
import { useRecoilValue } from 'recoil';
import request, { gql } from 'graphql-request';

import { appReadyState } from 'store/app';
import { isL2State } from 'store/wallet';

import Connector from 'containers/Connector';
import QUERY_KEYS from 'constants/queryKeys';
import { FUTURES_ENDPOINT, SECONDS_PER_DAY } from './constants';
import { calculateFundingRate } from './utils';
import Wei, { wei } from '@synthetixio/wei';

const useGetAverageFundingRateForMarket = (
	currencyKey: string | null,
	options?: UseQueryOptions<any | null>
) => {
	const isAppReady = useRecoilValue(appReadyState);
	const isL2 = useRecoilValue(isL2State);
	const { synthetixjs } = Connector.useContainer();

	return useQuery<any | null>(
		QUERY_KEYS.Futures.FundingRate(currencyKey || ''),
		async () => {
			if (!currencyKey) return null;
			const { contracts } = synthetixjs!;
			const marketAddress = contracts[`FuturesMarket${currencyKey.slice(1)}`].address;
			if (!marketAddress) return null;
			const minTimestamp = Math.floor(Date.now() / 1000) - SECONDS_PER_DAY

			try {
				const responseMin = await request(
					FUTURES_ENDPOINT,
					gql`
						query fundingRateUpdates($market: String!, $minTimestamp: BigInt!) {
							fundingRateUpdates(
								first: 1
								where: {
									market: $market,
									timestamp_gt: $minTimestamp
								}
								orderBy: sequenceLength
								orderDirection: asc
							) {
								timestamp
								funding
							}
						}
					`,
					{ market: marketAddress, minTimestamp: minTimestamp }
				);

				const responseMax = await request(
					FUTURES_ENDPOINT,
					gql`
						query fundingRateUpdates($market: String!) {
							fundingRateUpdates(
								first: 1
								where: {
									market: $market
								}
								orderBy: sequenceLength
								orderDirection: desc
							) {
								timestamp
								funding
							}
						}
					`,
					{ market: marketAddress}
				);


				return responseMin && responseMax ?
					calculateFundingRate(responseMin.fundingRateUpdates[0], responseMax.fundingRateUpdates[0]) :
					wei(0);
			} catch (e) {
				console.log(e);
				return null;
			}
		},
		{
			enabled: isAppReady && isL2 && !!synthetixjs,
			...options,
		}
	);
};

export default useGetAverageFundingRateForMarket;
