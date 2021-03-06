/* @jsx jsx */

import { jsx, useTheme } from '@keystone-ui/core';
import type { HTMLAttributes, ReactNode } from 'react';

import { Navigation } from './Navigation';
import { Logo } from './Logo';

type PageContainerProps = {
  children: ReactNode;
  header: ReactNode;
};

export const HEADER_HEIGHT = 80;

const PageWrapper = (props: HTMLAttributes<HTMLElement>) => {
  return (
    <div
      css={{
        display: 'grid',
        gridTemplateColumns: `minmax(280px, 320px) auto`,
        gridTemplateRows: `${HEADER_HEIGHT}px auto`,
        height: '100vh',
      }}
      {...props}
    />
  );
};

const Sidebar = (props: HTMLAttributes<HTMLElement>) => {
  const { colors } = useTheme();

  return (
    <aside
      css={{
        borderRight: `1px solid ${colors.border}`,
        minWidth: 0, // resolves collapsing issues in children
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      {...props}
    />
  );
};

const Content = (props: HTMLAttributes<HTMLElement>) => {
  const { colors, spacing } = useTheme();

  return (
    <main
      css={{
        backgroundColor: colors.background,
        boxSizing: 'border-box',
        minWidth: 0, // resolves collapsing issues in children
        paddingLeft: spacing.xlarge,
        paddingRight: spacing.xlarge,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      {...props}
    />
  );
};

export const PageContainer = ({ children, header }: PageContainerProps) => {
  const { colors, spacing } = useTheme();
  return (
    <PageWrapper>
      <div
        css={{
          alignItems: 'center',
          borderRight: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          paddingLeft: spacing.xlarge,
          paddingRight: spacing.xlarge,
        }}
      >
        <Logo />
      </div>
      <header
        css={{
          alignItems: 'center',
          backgroundColor: colors.background,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          minWidth: 0, // fix flex text truncation
          paddingLeft: spacing.xlarge,
          paddingRight: spacing.xlarge,
        }}
      >
        {header}
      </header>
      <Sidebar>
        <Navigation />
      </Sidebar>
      <Content>{children}</Content>
    </PageWrapper>
  );
};
