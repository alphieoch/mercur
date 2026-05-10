import { useParams } from "react-router-dom";

import { MetadataForm } from "@components/forms/metadata-form";
import { RouteDrawer } from "@components/modals";
import { useSeller, useUpdateSeller } from "@hooks/api/sellers";
import { ClientError } from "@mercurjs/client";

export const StoreMetadata = () => {
  const { id } = useParams();

  const { seller, isLoading, isError, error } = useSeller(id!);
  const { mutateAsync, isPending: isMutating } = useUpdateSeller(id!);

  if (isError) {
    throw error;
  }

  const handleSubmit = async (
    params: { metadata?: Record<string, unknown> | null },
    callbacks: {
      onSuccess?: () => void;
      onError?: (error: ClientError | string) => void;
    },
  ) => {
    try {
      const result = await mutateAsync({
        metadata: params.metadata === undefined ? undefined : params.metadata,
      });
      callbacks.onSuccess?.();

      return result;
    } catch (e) {
      const message = e instanceof ClientError ? e.message : "An error occurred";
      callbacks.onError?.(message);
      throw e;
    }
  };

  return (
    <RouteDrawer data-testid="store-metadata-drawer">
      <MetadataForm
        isPending={isLoading}
        isMutating={isMutating}
        hook={handleSubmit}
        metadata={seller?.metadata}
      />
    </RouteDrawer>
  );
};
