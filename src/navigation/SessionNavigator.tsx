import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SessionStackParamList } from './types';
import { ConsentScreen } from '@features/session/screens/ConsentScreen';
import { VideoRoomScreen } from '@features/session/screens/VideoRoomScreen';
import { PostSessionScreen } from '@features/session/screens/PostSessionScreen';
import { TipAfterSessionScreen } from '@features/session/screens/TipAfterSessionScreen';
import { FINANCIAL_FEATURES_ENABLED } from '@shared/constants/platformFeatures';

const Stack = createNativeStackNavigator<SessionStackParamList>();

export function SessionNavigator({ route }: { route: any }) {
  const { sessionId } = route.params;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="Consent" 
        component={ConsentScreen} 
        initialParams={{ sessionId }}
      />
      <Stack.Screen 
        name="VideoRoom" 
        component={VideoRoomScreen} 
        initialParams={{ sessionId }}
      />
      <Stack.Screen 
        name="PostSession" 
        component={PostSessionScreen} 
        initialParams={{ sessionId }}
      />
      {/* TipAfterSession apenas no Android — iOS compliance Guideline 1.1.4 */}
      {FINANCIAL_FEATURES_ENABLED && (
        <Stack.Screen 
          name="TipAfterSession" 
          component={TipAfterSessionScreen} 
          initialParams={{ sessionId }}
        />
      )}
    </Stack.Navigator>
  );
}
