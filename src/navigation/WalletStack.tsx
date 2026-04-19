import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WalletStackParamList } from './types';
import { WalletScreen } from '@features/wallet/screens/WalletScreen';
import { TransactionsScreen } from '@features/wallet/screens/TransactionsScreen';
import { WithdrawalScreen } from '@features/wallet/screens/WithdrawalScreen';

const Stack = createNativeStackNavigator<WalletStackParamList>();

export function WalletStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />
    </Stack.Navigator>
  );
}
