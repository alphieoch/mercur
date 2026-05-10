import { ReactNode, Children, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { TwoColumnPageSkeleton } from "../../../../components/common/skeleton";
import { TwoColumnPage } from "../../../../components/layout/pages";
import { useSeller } from "@/hooks/api";
import { SellerStatus } from "@mercurjs/types";

import { StoreGeneralSection } from "./store-general-section";
import { StorePaymentDetailsSection } from "./store-payment-details-section";
import { StoreCompanyDetailsSection } from "./store-company-details-section";
import { StoreConfigurationSection } from "./store-configuration-section";
import { StoreAddressSection } from "./store-address-section";
import { StoreSubscriptionSection } from "./store-subscription-section";
import { StoreMembersSection } from "./store-members-section";
import { StoreRequestSection } from "./store-request-section";
import { StoreOrdersSection } from "./store-orders-section";
import { StoreProductsSection } from "./store-products-section";
import {
  StoreDetailHeader,
  StoreDetailTitle,
  StoreDetailActions,
  StoreDetailEditButton,
} from "./store-detail-header";

const TABS = ["orders", "products", "users", "timeOff"] as const;

type Tab = (typeof TABS)[number];

const TabBar = ({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) => {
  const { t } = useTranslation();

  const labels: Record<Tab, string> = {
    orders: t("orders.domain"),
    users: t("users.domain"),
    products: t("products.domain"),
    timeOff: t("store.timeOff.header"),
  };

  return (
    <div
      role="tablist"
      aria-label={t("stores.domain")}
      className="-mx-1 flex flex-nowrap items-center gap-x-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:gap-x-3 sm:overflow-visible"
      data-testid="store-detail-tabs"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            role="tab"
            aria-selected={isActive ? "true" : "false"}
            aria-controls={`store-detail-tab-panel-${tab}`}
            id={`store-detail-tab-${tab}`}
            data-testid={`store-detail-tab-${tab}`}
            className={`txt-compact-medium-plus shrink-0 rounded-full px-4 py-1.5 transition-colors sm:shrink ${
              isActive
                ? "border-ui-border-base bg-ui-bg-base shadow-borders-base text-ui-fg-base"
                : "text-ui-fg-subtle hover:text-ui-fg-base"
            }`}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
};

const Root = ({ children }: { children?: ReactNode }) => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const { seller, isLoading, isError, error } = useSeller(id!);

  if (isLoading || !seller) {
    return <TwoColumnPageSkeleton mainSections={3} sidebarSections={3} />;
  }

  if (isError) {
    throw error;
  }

  if (Children.count(children) > 0) {
    return (
      <TwoColumnPage
        data={seller}
        hasOutlet
        showMetadata
        data-testid="store-detail-page"
      >
        {children}
      </TwoColumnPage>
    );
  }

  return (
    <TwoColumnPage
      data={seller}
      hasOutlet
      showMetadata
      data-testid="store-detail-page"
    >
      <TwoColumnPage.Main>
        {seller.status === SellerStatus.PENDING_APPROVAL &&
          !seller.approved_at &&
          !seller.rejected_at && (
            <StoreRequestSection seller={seller} />
          )}
        <StoreGeneralSection seller={seller} />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "orders" && (
          <div
            role="tabpanel"
            id="store-detail-tab-panel-orders"
            aria-labelledby="store-detail-tab-orders"
          >
            <StoreOrdersSection sellerId={seller.id} />
          </div>
        )}
        {activeTab === "users" && (
          <div
            role="tabpanel"
            id="store-detail-tab-panel-users"
            aria-labelledby="store-detail-tab-users"
          >
            <StoreMembersSection sellerId={seller.id} />
          </div>
        )}
        {activeTab === "products" && (
          <div
            role="tabpanel"
            id="store-detail-tab-panel-products"
            aria-labelledby="store-detail-tab-products"
          >
            <StoreProductsSection sellerId={seller.id} />
          </div>
        )}
        {activeTab === "timeOff" && (
          <div
            role="tabpanel"
            id="store-detail-tab-panel-timeOff"
            aria-labelledby="store-detail-tab-timeOff"
          >
            <StoreConfigurationSection seller={seller} />
          </div>
        )}
      </TwoColumnPage.Main>
      <TwoColumnPage.Sidebar>
        <StoreAddressSection seller={seller} />
        <StoreCompanyDetailsSection seller={seller} />
        <StorePaymentDetailsSection seller={seller} />
        <StoreSubscriptionSection seller={seller} />
      </TwoColumnPage.Sidebar>
    </TwoColumnPage>
  );
};

export const StoreDetailPage = Object.assign(Root, {
  Main: TwoColumnPage.Main,
  Sidebar: TwoColumnPage.Sidebar,
  MainGeneralSection: StoreGeneralSection,
  MainConfigurationSection: StoreConfigurationSection,
  MainPaymentDetailsSection: StorePaymentDetailsSection,
  MainCompanyDetailsSection: StoreCompanyDetailsSection,
  SidebarAddressSection: StoreAddressSection,
  SidebarSubscriptionSection: StoreSubscriptionSection,
  SidebarMembersSection: StoreMembersSection,
  Header: StoreDetailHeader,
  HeaderTitle: StoreDetailTitle,
  HeaderActions: StoreDetailActions,
  HeaderEditButton: StoreDetailEditButton,
});
