import React, {
  createContext,
  useMemo,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import { SegmentClient, useSegmentClient } from '@newfront/react-segment-hooks';
import { useRouter, NextRouter } from 'next/router';

/**
 * This is the context object that useAnalytics will be grabbing the client from.
 * When you're trying to mock analytics calls, you should pass a fake value here.
 */
export const AnalyticsContext = createContext<SegmentClient | undefined>(
  undefined
);

/**
 * The user that will be identified to Segment.
 */
interface User {
  id: string;
  traits: Record<string, any>;
}

/**
 * The provider props.
 */
interface AnalyticsProviderProps {
  children: React.ReactNode;
  user?: User;
  apiKey: string;
  mockAnalyticsClient?: SegmentClient;
  mockNextRouter?: NextRouter;
}

/**
 * Mock provider props
 */
interface MockAnalyticsProviderProps {
  children: React.ReactNode;
}

/**
 * Track events on route changes
 * @param analytics Segment client
 * @param router Next router
 */
function useRouteChangeAnalytics(analytics: SegmentClient, router: NextRouter) {
  const { events } = router;

  const onRouteChangeComplete = useCallback(() => {
    analytics.page();
  }, [analytics]);

  // Call analytics.page whenever there is a page transition
  useEffect(() => {
    events.on('routeChangeComplete', onRouteChangeComplete);
    return () => {
      events.off('routeChangeComplete', onRouteChangeComplete);
    };
  }, [events, onRouteChangeComplete]);
}

/**
 * Identify the current user
 * @param analytics Segment client
 * @param user Any custom user ojbect
 */
function useUserAnalytics(analytics: SegmentClient, user?: User) {
  // Whenever the user changes call analytics.identify so that all
  // track and page calls will be associated with that user.
  useEffect(() => {
    if (user) {
      // We should only call identify if the user is logged in. For anonymous users
      // this should never be called. Segment will create an anonymous ID for the user
      // and store that in local storage.
      // Calling identify in analytics.js will automatically associate all future track
      // calls with this user. This is not have the node client works.
      analytics.identify({
        userId: user.id,
        traits: user.traits,
      });
    }
  }, [analytics, user]);
}

/**
 * Load the Segment snippet and add it to the app context. This is required for the useAnalytics hook
 * to work. This should be added to the top-level React component in _app.
 *
 * When server-rendering, the analytics events will be a no-op.
 *
 * @param props AnalyticsProviderProps
 */
export function AnalyticsProvider(props: AnalyticsProviderProps): JSX.Element {
  const { children, user, apiKey, mockAnalyticsClient, mockNextRouter } = props;

  const analytics =
    mockAnalyticsClient ||
    useSegmentClient({
      apiKey,
    });

  const router = mockNextRouter || useRouter();

  useRouteChangeAnalytics(analytics, router);
  useUserAnalytics(analytics, user);

  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Create a mock analytics client that can be used in tests and stories. This will create an analytics client
 * that will never send any real events, it will just keep them in a queue:
 *
 *      return (
 *        <MockAnalyticsProvider>
 *          <MyComponent />
 *        </MockAnalyticsProvider>
 *      )
 *
 * Now when <MyComponent /> uses the useAnalytics hook to make track calls they won't be sent:
 *
 *      const analytics = useAnalytics();
 *      analytics.track(policyUpdated({ uuid: '12456' }));
 *
 * If you want to check that events were correctly fired, you can pass in a fake client:
 *
 *      const analytics = useMockSegment();
 *      return (
 *        <AnalyticsContext.Provider value={analytics}>
 *          {children}
 *        </AnalyticsContext.Provider>
 *      )
 *
 * This will allow you to spy on the methods to make sure they're firing as you'd expect:
 *
 *      const analytics = useMockSegment();
 *      jest.spyOn(analytics, 'track');
 *      const { getByText } = render(
 *        <AnalyticsContext.Provider value={analytics}>
 *          <PolicyEditor id="12345" />
 *        </AnalyticsContext.Provider>
 *      );
 *      fireEvent.click(getByText('Update policy'));
 *      expect(analytics.track).hasBeenCalledWith(policyUpdated({
 *        uuid: '12345'
 *      }))
 *
 * @param props
 */
export function MockAnalyticsProvider(
  props: MockAnalyticsProviderProps
): JSX.Element {
  const { children } = props;
  const analytics = useMockSegment();
  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * This is the hook that the app will use to access the NewfrontAnalytics instance. This will throw an error
 * if you haven't add AnalyticsContext to the React tree.
 */
export function useAnalytics(): SegmentClient {
  const analytics = useContext(AnalyticsContext);
  if (!analytics) {
    throw new Error(
      'Missing AnalyticsContext. Did you forget to wrap your component with <AnalyticsProvider>?'
    );
  }
  return analytics;
}

/**
 * Create a mock version of the Segment client that can be used with the AnalyticsContext.Provider to fake calls
 * during testings and stories.
 */
function useMockSegment(): SegmentClient {
  return useMemo(() => {
    return new SegmentClient({
      apiKey: 'test',
    });
  }, []);
}
