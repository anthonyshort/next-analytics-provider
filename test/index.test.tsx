import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { SegmentClient } from '@newfront/react-segment-hooks';
import { AnalyticsProvider, useAnalytics } from '../src';
import { NextRouter } from 'next/router';
import { EventEmitter } from 'events';
import MutationObserver from '@sheerun/mutationobserver-shim';

window.MutationObserver = MutationObserver;

function Component() {
  const analytics = useAnalytics();

  function track() {
    analytics.track({
      event: 'test',
      properties: {
        hello: 'world',
      },
    });
  }

  return <button onClick={track}>Track</button>;
}

export function createMockRouter(): NextRouter {
  return {
    pathname: '/',
    isFallback: false,
    query: {},
    asPath: '/',
    route: '/',
    back: () => {},
    beforePopState: () => {},
    push: () => Promise.resolve(true),
    replace: () => Promise.resolve(true),
    reload: () => {},
    prefetch: () => Promise.resolve(),
    events: new EventEmitter(),
  };
}

describe('<AnalyticsProvider>', () => {
  it('calls identify and tracks route changes', async () => {
    const fakeClient = new SegmentClient({
      apiKey: 'test',
    });
    const fakeRouter = createMockRouter();
    const identifyFn = jest.spyOn(fakeClient, 'identify');
    const pageFn = jest.spyOn(fakeClient, 'page');
    const trackFn = jest.spyOn(fakeClient, 'track');

    const { findByText } = render(
      <AnalyticsProvider
        apiKey="1"
        mockAnalyticsClient={fakeClient}
        mockNextRouter={fakeRouter}
        user={{
          id: '1',
          traits: {
            email: 'fsdfsdf',
          },
        }}
      >
        <Component />
      </AnalyticsProvider>
    );

    expect(identifyFn).toBeCalledWith({
      userId: '1',
      traits: {
        email: 'fsdfsdf',
      },
    });

    fakeRouter.events.emit('routeChangeComplete');

    expect(pageFn).toBeCalled();

    const buttonEl = await findByText('Track');

    act(() => {
      fireEvent.click(buttonEl);
    });

    expect(trackFn).toBeCalledWith({
      event: 'test',
      properties: {
        hello: 'world',
      },
    });
  });
});
