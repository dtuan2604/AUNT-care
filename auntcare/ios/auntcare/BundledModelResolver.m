#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface BundledModelResolver : NSObject <RCTBridgeModule>
@end

@implementation BundledModelResolver

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(resolveModel,
                 resolveModel:(NSString *)assetName
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *trimmedName = [assetName stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if (trimmedName.length == 0) {
    reject(@"bundled_model_invalid_name", @"Bundled model asset name is required.", nil);
    return;
  }

  NSString *resourceName = [trimmedName stringByDeletingPathExtension];
  NSString *resourceExtension = [trimmedName pathExtension];
  NSString *resolvedPath = nil;

  if (resourceName.length > 0) {
    resolvedPath = [[NSBundle mainBundle] pathForResource:resourceName
                                                   ofType:resourceExtension.length > 0 ? resourceExtension : nil];
  }

  if (!resolvedPath) {
    resolvedPath = [[NSBundle mainBundle] pathForResource:trimmedName ofType:nil];
  }

  if (!resolvedPath) {
    NSString *resourceRoot = [[NSBundle mainBundle] resourcePath];
    NSString *candidatePath = [resourceRoot stringByAppendingPathComponent:trimmedName];
    if ([[NSFileManager defaultManager] fileExistsAtPath:candidatePath]) {
      resolvedPath = candidatePath;
    }
  }

  if (!resolvedPath) {
    NSString *resourceRoot = [[NSBundle mainBundle] resourcePath];
    NSArray<NSString *> *bundleContents =
        [[NSFileManager defaultManager] contentsOfDirectoryAtPath:resourceRoot error:nil] ?: @[];
    NSPredicate *ggufPredicate = [NSPredicate predicateWithFormat:@"SELF ENDSWITH[c] %@", @".gguf"];
    NSArray<NSString *> *availableGgufFiles = [bundleContents filteredArrayUsingPredicate:ggufPredicate];
    NSString *availableFilesLabel =
        availableGgufFiles.count > 0 ? [availableGgufFiles componentsJoinedByString:@", "] : @"none";
    NSString *message = [NSString
        stringWithFormat:@"Bundled model %@ was not found in the iOS app bundle. Available GGUF files: %@. Rebuild the iOS app after changing bundled resources.",
                         trimmedName,
                         availableFilesLabel];
    reject(@"bundled_model_missing", message, nil);
    return;
  }

  resolve([NSString stringWithFormat:@"file://%@", resolvedPath]);
}

RCT_REMAP_METHOD(getRuntimeInfo,
                 getRuntimeInfoWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
#if TARGET_OS_SIMULATOR
  BOOL isSimulator = YES;
#else
  BOOL isSimulator = NO;
#endif

  resolve(@{
    @"isSimulator": @(isSimulator),
  });
}

@end
